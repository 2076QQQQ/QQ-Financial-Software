import db from '../../database';

export const checkEmailHandler = async (req: any, res: any) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    // Read the latest data from the database file
    await db.read();

    // Find a user with the given email
    const user = db.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());

    res.status(200).json({ exists: !!user });
  } catch (error) {
    console.error('Error checking email:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
