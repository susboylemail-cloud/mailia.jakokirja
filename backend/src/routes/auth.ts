import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database';
import { User, JWTPayload } from '../types';
import logger from '../config/logger';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Generate JWT tokens
const generateAccessToken = (payload: JWTPayload): string => {
    return jwt.sign(payload, process.env.JWT_SECRET!, {
        expiresIn: process.env.JWT_EXPIRE || '15m'
    });
};

const generateRefreshToken = (payload: JWTPayload): string => {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
        expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d'
    });
};

// Login
router.post('/login',
    body('username').notEmpty().trim(),
    body('password').notEmpty(),
    async (req: Request, res: Response) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { username, password } = req.body;

            // Get user from database
            const result = await query(
                'SELECT * FROM users WHERE username = $1 AND is_active = true',
                [username]
            );

            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const user: User = result.rows[0];

            // Verify password
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            if (!isValidPassword) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Generate tokens
            const payload: JWTPayload = {
                userId: user.id,
                username: user.username,
                role: user.role
            };

            const accessToken = generateAccessToken(payload);
            const refreshToken = generateRefreshToken(payload);

            // Store refresh token in database
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);

            await query(
                'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
                [user.id, refreshToken, expiresAt]
            );

            logger.info(`User logged in: ${username}`);

            res.json({
                accessToken,
                refreshToken,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    fullName: user.full_name,
                    role: user.role
                }
            });
        } catch (error) {
            logger.error('Login error:', error);
            res.status(500).json({ error: 'Login failed' });
        }
    }
);

// Refresh token
router.post('/refresh',
    body('refreshToken').notEmpty(),
    async (req: Request, res: Response) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { refreshToken } = req.body;

            // Verify refresh token
            const decoded = jwt.verify(
                refreshToken,
                process.env.JWT_REFRESH_SECRET!
            ) as JWTPayload;

            // Check if refresh token exists in database
            const result = await query(
                'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
                [refreshToken]
            );

            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Invalid refresh token' });
            }

            // Generate new access token
            const payload: JWTPayload = {
                userId: decoded.userId,
                username: decoded.username,
                role: decoded.role
            };

            const accessToken = generateAccessToken(payload);

            res.json({ accessToken });
        } catch (error) {
            logger.error('Refresh token error:', error);
            res.status(401).json({ error: 'Invalid refresh token' });
        }
    }
);

// Logout
router.post('/logout',
    authenticate,
    body('refreshToken').optional(),
    async (req: AuthRequest, res: Response) => {
        try {
            const { refreshToken } = req.body;

            if (refreshToken) {
                // Delete refresh token from database
                await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
            }

            logger.info(`User logged out: ${req.user?.username}`);
            res.json({ message: 'Logged out successfully' });
        } catch (error) {
            logger.error('Logout error:', error);
            res.status(500).json({ error: 'Logout failed' });
        }
    }
);

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const result = await query(
            'SELECT id, username, email, full_name, role, created_at FROM users WHERE id = $1',
            [req.user!.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// Register new user (admin only)
router.post('/register',
    authenticate,
    body('username').notEmpty().trim().isLength({ min: 3 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('fullName').optional().trim(),
    body('role').isIn(['admin', 'driver', 'manager']),
    async (req: AuthRequest, res: Response) => {
        try {
            // Only admins can register new users
            if (req.user!.role !== 'admin') {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { username, email, password, fullName, role } = req.body;

            // Check if user already exists
            const existingUser = await query(
                'SELECT id FROM users WHERE username = $1 OR email = $2',
                [username, email]
            );

            if (existingUser.rows.length > 0) {
                return res.status(400).json({ error: 'User already exists' });
            }

            // Hash password
            const passwordHash = await bcrypt.hash(password, 10);

            // Create user
            const result = await query(
                `INSERT INTO users (username, email, password_hash, full_name, role) 
                VALUES ($1, $2, $3, $4, $5) 
                RETURNING id, username, email, full_name, role, created_at`,
                [username, email, passwordHash, fullName, role]
            );

            logger.info(`New user registered: ${username}`);
            res.status(201).json(result.rows[0]);
        } catch (error) {
            logger.error('Registration error:', error);
            res.status(500).json({ error: 'Registration failed' });
        }
    }
);

export default router;
