import dotenv from 'dotenv';
import { createServer } from 'http';
import app from './app';
import { initializeSocketIO } from './utils/socket';
import './jobs/expiry.job'; // Import cron jobs

dotenv.config();

const PORT = process.env.PORT || 5000;

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.IO
initializeSocketIO(httpServer);

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔌 Socket.IO enabled`);
  console.log(`🏢 Environment: ${process.env.NODE_ENV || 'development'}`);
});




