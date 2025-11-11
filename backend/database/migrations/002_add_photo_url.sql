-- Add photo_url column to route_messages table
ALTER TABLE route_messages 
ADD COLUMN photo_url TEXT;

-- Add index for faster queries
CREATE INDEX idx_route_messages_photo_url ON route_messages(photo_url) WHERE photo_url IS NOT NULL;
