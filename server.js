// ============================================
// ALUMNI PORTAL - BACKEND SERVER
// File: server.js
// Deploy on Render.com
// ============================================

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;

dotenv.config();

const app = express();

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ============================================
// DATABASE CONNECTION
// ============================================

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ MongoDB Error:', err));

// ============================================
// SCHEMAS (Database Structure)
// ============================================

const UniversitySchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true },
  slug: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  logo: { type: String, default: '' },
  description: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  profilePhoto: { type: String, default: '' },
  role: { type: String, enum: ['alumni', 'admin', 'representative'], default: 'alumni' },
  university: { type: mongoose.Schema.Types.ObjectId, ref: 'University' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  parentEmail: { type: String, default: '' },
  parentPhone: { type: String, default: '' },
  rollNumber: { type: String, default: '' },
  courseDegree: { type: String, default: '' },
  school: { type: String, default: '' },
  graduationYear: { type: Number, default: null },
  currentCity: { type: String, default: '' },
  hometown: { type: String, default: '' },
  company: { type: String, default: '' },
  designation: { type: String, default: '' },
  bio: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  university: { type: mongoose.Schema.Types.ObjectId, ref: 'University' },
  image: { type: String, default: '' },
  type: { type: String, enum: ['announcement', 'job', 'requirement', 'recruitment', 'general'], default: 'general' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const CommentSchema = new mongoose.Schema({
  content: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  createdAt: { type: Date, default: Date.now },
});

const WorkshopSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  location: { type: String, default: '' },
  isOnline: { type: Boolean, default: false },
  meetingLink: { type: String, default: '' },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  university: { type: mongoose.Schema.Types.ObjectId, ref: 'University' },
  attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  image: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  content: { type: String, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// Create Models
const University = mongoose.model('University', UniversitySchema);
const User = mongoose.model('User', UserSchema);
const Post = mongoose.model('Post', PostSchema);
const Comment = mongoose.model('Comment', CommentSchema);
const Workshop = mongoose.model('Workshop', WorkshopSchema);
const Message = mongoose.model('Message', MessageSchema);

// ============================================
// HELPER FUNCTIONS
// ============================================

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', (req, res) => {
  res.json({
    status: '✅ Server is running',
    timestamp: new Date(),
    database: 'MongoDB Atlas Connected',
    environment: process.env.NODE_ENV || 'production'
  });
});

// ============================================
// UNIVERSITY ROUTES
// ============================================

app.post('/api/university/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }
    
    const slug = name.toLowerCase().replace(/\s+/g, '_');
    const hashedPassword = await hashPassword(password);
    
    const university = new University({
      name,
      slug,
      email,
      password: hashedPassword,
    });
    
    await university.save();
    const token = generateToken(university._id);
    
    res.status(201).json({
      message: 'University registered successfully',
      token,
      university
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/university/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const university = await University.findOne({ email });
    
    if (!university || !(await comparePassword(password, university.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = generateToken(university._id);
    res.json({ message: 'Login successful', token, university });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ALUMNI ROUTES
// ============================================

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, phone, university, parentEmail, parentPhone, rollNumber } = req.body;
    
    const hashedPassword = await hashPassword(password);
    
    const user = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      university,
      parentEmail,
      parentPhone,
      rollNumber,
      status: 'pending',
    });
    
    await user.save();
    const token = generateToken(user._id);
    
    res.status(201).json({ message: 'Signup successful. Awaiting approval.', token, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).populate('university');
    
    if (!user || !(await comparePassword(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (user.status === 'rejected') {
      return res.status(403).json({ error: 'Your account has been rejected' });
    }
    
    const token = generateToken(user._id);
    res.json({ message: 'Login successful', token, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// USER PROFILE ROUTES
// ============================================

app.get('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('university');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.userId, req.body, { new: true });
    res.json({ message: 'Profile updated', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// POSTS ROUTES
// ============================================

app.post('/api/posts', authMiddleware, async (req, res) => {
  try {
    const { title, content, type } = req.body;
    const user = await User.findById(req.userId);
    
    const post = new Post({
      title,
      content,
      type,
      author: req.userId,
      university: user.university,
    });
    
    await post.save();
    await post.populate('author', 'name profilePhoto');
    res.status(201).json({ message: 'Post created', post });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/posts/:universityId', async (req, res) => {
  try {
    const posts = await Post.find({ university: req.params.universityId })
      .populate('author', 'name profilePhoto')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/posts/:postId', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(req.params.postId, req.body, { new: true });
    res.json({ message: 'Post updated', post });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/posts/:postId', authMiddleware, async (req, res) => {
  try {
    await Post.findByIdAndDelete(req.params.postId);
    res.json({ message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// COMMENTS ROUTES
// ============================================

app.post('/api/comments', authMiddleware, async (req, res) => {
  try {
    const { postId, content } = req.body;
    
    const comment = new Comment({
      content,
      author: req.userId,
      post: postId,
    });
    
    await comment.save();
    await comment.populate('author', 'name profilePhoto');
    res.status(201).json({ message: 'Comment added', comment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/comments/:postId', async (req, res) => {
  try {
    const comments = await Comment.find({ post: req.params.postId })
      .populate('author', 'name profilePhoto')
      .sort({ createdAt: -1 });
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MESSAGING ROUTES
// ============================================

app.post('/api/messages', authMiddleware, async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    
    const message = new Message({
      sender: req.userId,
      receiver: receiverId,
      content,
    });
    
    await message.save();
    res.status(201).json({ message: 'Message sent', data: message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/messages/:userId', authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.userId, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.userId }
      ]
    }).sort({ createdAt: -1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

app.get('/api/admin/pending-approvals/:universityId', authMiddleware, async (req, res) => {
  try {
    const users = await User.find({
      university: req.params.universityId,
      status: 'pending'
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/approve-user/:userId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { status: 'approved' },
      { new: true }
    );
    res.json({ message: 'User approved', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/reject-user/:userId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { status: 'rejected' },
      { new: true }
    );
    res.json({ message: 'User rejected', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// WORKSHOPS/EVENTS ROUTES
// ============================================

app.post('/api/workshops', authMiddleware, async (req, res) => {
  try {
    const { title, description, date, time, isOnline, meetingLink, location } = req.body;
    const user = await User.findById(req.userId);
    
    const workshop = new Workshop({
      title,
      description,
      date,
      time,
      isOnline,
      meetingLink,
      location,
      creator: req.userId,
      university: user.university,
    });
    
    await workshop.save();
    res.status(201).json({ message: 'Event created', workshop });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/workshops/:universityId', async (req, res) => {
  try {
    const workshops = await Workshop.find({ university: req.params.universityId })
      .populate('creator', 'name')
      .sort({ date: -1 });
    res.json(workshops);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/workshops/:workshopId/register', authMiddleware, async (req, res) => {
  try {
    const workshop = await Workshop.findByIdAndUpdate(
      req.params.workshopId,
      { $push: { attendees: req.userId } },
      { new: true }
    );
    res.json({ message: 'Registered for event', workshop });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DIRECTORY/SEARCH ROUTES
// ============================================

app.get('/api/users/directory/:universityId', async (req, res) => {
  try {
    const { graduationYear, currentCity, company, designation } = req.query;
    let query = { university: req.params.universityId, status: 'approved' };
    
    if (graduationYear) query.graduationYear = parseInt(graduationYear);
    if (currentCity) query.currentCity = currentCity;
    if (company) query.company = company;
    if (designation) query.designation = designation;
    
    const users = await User.find(query)
      .select('name email company designation currentCity graduationYear profilePhoto')
      .limit(50);
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/search', async (req, res) => {
  try {
    const { name, email } = req.query;
    let query = { status: 'approved' };
    
    if (name) query.name = { $regex: name, $options: 'i' };
    if (email) query.email = { $regex: email, $options: 'i' };
    
    const users = await User.find(query).select('name email company designation profilePhoto');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong: ' + err.message });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
    ╔════════════════════════════════════════╗
    ║   ✅ ALUMNI PORTAL - BACKEND          ║
    ║   🌍 Server running on port ${PORT}     ║
    ║   📍 MongoDB Atlas Connected           ║
    ║   🚀 Ready for production              ║
    ╚════════════════════════════════════════╝
  `);
});
