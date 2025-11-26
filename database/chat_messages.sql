-- Create chat_messages table for real-time chat functionality
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_game_id ON chat_messages(game_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read chat messages for games they're part of
CREATE POLICY "Users can read chat messages for their games" ON chat_messages
  FOR SELECT USING (
    game_id IN (
      SELECT id FROM games 
      WHERE player1_id = auth.uid() OR player2_id = auth.uid()
    )
  );

-- Create policy to allow users to insert chat messages for games they're part of
CREATE POLICY "Users can send chat messages for their games" ON chat_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    game_id IN (
      SELECT id FROM games 
      WHERE player1_id = auth.uid() OR player2_id = auth.uid()
    )
  );