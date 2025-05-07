const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Middleware
const corsOptions = {
  origin: 'http://172.31.17.108:5173', // Your frontend URL
  optionsSuccessStatus: 200,
  credentials: true
};

app.use(cors(corsOptions));
app.use('/uploads', express.static('uploads'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const emailRoutes = require('./emailRoutes');
const passwordResetRoutes = require('./passwordResetRoutes');
app.use('/api', emailRoutes);
app.use('/api', passwordResetRoutes);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.log(err));

// Member Schema
const memberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  instrument: { type: String, required: true },
  bio: { type: String, required: true },
  image: { type: String, required: true },
  isCaptain: { type: Boolean, default: false },
  order: { type: Number, default: 999 }, // for controlling display order
  active: { type: Boolean, default: true }
}, { timestamps: true });

const Member = mongoose.model('Member', memberSchema);

// Performance Schema
const performanceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: String, required: true },
  venue: { type: String, required: true },
  city: { type: String, required: true },
  image: { type: String, required: true },
  description: { type: String, required: true },
  ticketLink: { type: String, default: '' },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const Performance = mongoose.model('Performance', performanceSchema);

// Admin user schema for authentication
const Admin = require('./models/Admin');

module.exports.Admin = Admin;

// Storage config for images
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function(req, file, cb) {
    cb(null, uuidv4() + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/webp') {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 5 // 5MB max size
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token == null) return res.sendStatus(401);
  
  jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Routes

// Admin authentication
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find admin
    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(400).json({ message: 'Invalid credentials' });
    
    // Check password
    const validPassword = await bcrypt.compare(password, admin.password);
    if (!validPassword) return res.status(400).json({ message: 'Invalid credentials' });
    
    // Create token
    const token = jwt.sign(
      { id: admin._id, username: admin.username },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '1h' }
    );
    
    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Initialize admin account if none exists
const initializeAdmin = async () => {
  try {
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      // Create default admin user
      const hashedPassword = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'admin123', 10);
      await Admin.create({
        username: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
        password: hashedPassword,
        email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com' // Add default email
      });
      console.log('Default admin account created');
    }
  } catch (error) {
    console.error('Error initializing admin account:', error);
  }
};

// MEMBER ROUTES

// Get all active members
app.get('/api/members', async (req, res) => {
  console.log("request received");
  try {
    const members = await Member.find({ active: true }).sort({ order: 1, createdAt: 1 });
    res.json(members);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Get all members (including inactive)
app.get('/api/admin/members', authenticateToken, async (req, res) => {
  try {
    const members = await Member.find().sort({ order: 1, createdAt: 1 });
    res.json(members);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get a specific member by ID
app.get('/api/admin/members/:id', authenticateToken, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    res.json(member);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new member (with image upload)
app.post('/api/admin/members', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { name, instrument, bio, isCaptain, order } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: 'Image is required' });
    }
    
    const newMember = new Member({
      name,
      instrument,
      bio,
      image: `/uploads/${req.file.filename}`,
      isCaptain: isCaptain === 'true',
      order: order ? parseInt(order) : 999
    });
    
    const savedMember = await newMember.save();
    res.status(201).json(savedMember);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update member
app.put('/api/admin/members/:id', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { name, instrument, bio, isCaptain, order, active } = req.body;
    
    // Get existing member to check if we need to update the image
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    
    // Update member data
    member.name = name;
    member.instrument = instrument;
    member.bio = bio;
    member.isCaptain = isCaptain === 'true';
    member.order = order ? parseInt(order) : member.order;
    member.active = active === 'true';
    
    // Update image if a new one was uploaded
    if (req.file) {
      member.image = `/uploads/${req.file.filename}`;
    }
    
    const updatedMember = await member.save();
    res.json(updatedMember);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete member
app.delete('/api/admin/members/:id', authenticateToken, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    
    await Member.findByIdAndDelete(req.params.id);
    res.json({ message: 'Member deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PERFORMANCE ROUTES

// Get all performances (separated by upcoming/previous based on date)
app.get('/api/performances', async (req, res) => {
  try {
    const performances = await Performance.find({ active: true });
    
    // Sort and separate performances based on date
    const currentDate = new Date();
    
    const upcomingPerformances = performances
      .filter(perf => new Date(perf.date) >= currentDate)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const previousPerformances = performances
      .filter(perf => new Date(perf.date) < currentDate)
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // Reverse chronological
    
    res.json({
      upcoming: upcomingPerformances,
      previous: previousPerformances
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Get all performances
app.get('/api/admin/performances', authenticateToken, async (req, res) => {
  try {
    const performances = await Performance.find().sort({ date: -1 });
    res.json(performances);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get a specific performance by ID
app.get('/api/admin/performances/:id', authenticateToken, async (req, res) => {
  try {
    const performance = await Performance.findById(req.params.id);
    if (!performance) return res.status(404).json({ message: 'Performance not found' });
    res.json(performance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new performance
// Create new performance - update in your index.js
app.post('/api/admin/performances', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { title, date, venue, city, description, ticketLink, active } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: 'Image is required' });
    }
    
    const newPerformance = new Performance({
      title,
      date,
      venue,
      city,
      description,
      ticketLink: ticketLink || '',
      image: `/uploads/${req.file.filename}`,
      active: active === 'true'
    });
    
    const savedPerformance = await newPerformance.save();
    res.status(201).json(savedPerformance);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update performance
app.put('/api/admin/performances/:id', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { title, date, venue, city, description, ticketLink, active } = req.body;
    
    // Get existing performance
    const performance = await Performance.findById(req.params.id);
    if (!performance) return res.status(404).json({ message: 'Performance not found' });
    
    // Update performance data
    performance.title = title;
    performance.date = date;
    performance.venue = venue;
    performance.city = city;
    performance.description = description;
    performance.ticketLink = ticketLink || '';
    performance.active = active === 'true';
    
    // Update image if a new one was uploaded
    if (req.file) {
      performance.image = `/uploads/${req.file.filename}`;
    }
    
    const updatedPerformance = await performance.save();
    res.json(updatedPerformance);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete performance
app.delete('/api/admin/performances/:id', authenticateToken, async (req, res) => {
  try {
    const performance = await Performance.findById(req.params.id);
    if (!performance) return res.status(404).json({ message: 'Performance not found' });
    
    await Performance.findByIdAndDelete(req.params.id);
    res.json({ message: 'Performance deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Server initialization
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initializeAdmin();
});
