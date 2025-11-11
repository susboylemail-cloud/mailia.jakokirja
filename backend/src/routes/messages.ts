import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, AuthRequest } from '../middleware/auth';
import { query } from '../config/database';
import { io } from '../services/websocket';
import logger from '../config/logger';

const router = Router();

// Configure multer for photo uploads
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'issue-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (_req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Get all messages for today (for admin view)
router.get('/today', authenticate, async (_req: AuthRequest, res): Promise<void> => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const queryText = `
            SELECT 
                rm.*,
                r.route_date,
                c.circuit_id,
                c.circuit_name,
                u.username
            FROM route_messages rm
            JOIN routes r ON rm.route_id = r.id
            JOIN circuits c ON r.circuit_id = c.id
            JOIN users u ON rm.user_id = u.id
            WHERE r.route_date = $1
            ORDER BY rm.created_at DESC
        `;

        const result = await query(queryText, [today]);
        res.json(result.rows);
    } catch (error) {
        logger.error('Get today messages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Create a new message
router.post('/',
    authenticate,
    body('routeId').isInt(),
    body('messageType').isIn(['note', 'issue', 'alert']),
    body('message').notEmpty(),
    async (req: AuthRequest, res): Promise<void> => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ errors: errors.array() });
                return;
            }

            const { routeId, messageType, message } = req.body;
            const userId = req.user!.userId;

            const result = await query(
                `INSERT INTO route_messages (route_id, user_id, message_type, message)
                VALUES ($1, $2, $3, $4)
                RETURNING *`,
                [routeId, userId, messageType, message]
            );

            // Broadcast to all clients
            const messageData = {
                ...result.rows[0],
                username: req.user!.username
            };
            
            io?.emit('message:received', messageData);
            logger.info('Broadcasted message:received to all clients', messageData);

            res.json(result.rows[0]);
        } catch (error) {
            logger.error('Create message error:', error);
            res.status(500).json({ error: 'Failed to create message' });
        }
    }
);

// Create a message with photo
router.post('/:routeId',
    authenticate,
    upload.single('photo'),
    async (req: AuthRequest, res): Promise<void> => {
        try {
            const { routeId } = req.params;
            const { message_type, message_content } = req.body;
            const userId = req.user!.userId;

            // Get photo URL if file was uploaded
            let photoUrl: string | null = null;
            if (req.file) {
                photoUrl = `/uploads/${req.file.filename}`;
            }

            const result = await query(
                `INSERT INTO route_messages (route_id, user_id, message_type, message, photo_url)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *`,
                [routeId, userId, message_type, message_content, photoUrl]
            );

            // Broadcast to all clients
            const messageData = {
                ...result.rows[0],
                username: req.user!.username
            };
            
            io?.emit('message:received', messageData);
            logger.info('Broadcasted message:received with photo to all clients', messageData);

            res.json(result.rows[0]);
        } catch (error) {
            logger.error('Create message with photo error:', error);
            res.status(500).json({ error: 'Failed to create message with photo' });
        }
    }
);

// Mark message as read
router.post('/:id/read', authenticate, async (req: AuthRequest, res): Promise<void> => {
    try {
        const { id } = req.params;

        const result = await query(
            `UPDATE route_messages 
            SET is_read = true 
            WHERE id = $1 
            RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Message not found' });
            return;
        }

        // Broadcast to all clients
        io?.emit('message:read', { messageId: parseInt(id) });
        logger.info('Broadcasted message:read to all clients', { messageId: id });

        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Mark message as read error:', error);
        res.status(500).json({ error: 'Failed to mark message as read' });
    }
});

// Delete a message
router.delete('/:id', authenticate, async (req: AuthRequest, res): Promise<void> => {
    try {
        const { id } = req.params;

        const result = await query(
            `DELETE FROM route_messages 
            WHERE id = $1 
            RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Message not found' });
            return;
        }

        // Broadcast to all clients
        io?.emit('message:deleted', { messageId: parseInt(id) });
        logger.info('Broadcasted message:deleted to all clients', { messageId: id });

        res.json({ success: true, message: 'Message deleted' });
    } catch (error) {
        logger.error('Delete message error:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

export default router;
