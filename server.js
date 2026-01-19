const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Storage setup for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb){
    const dir = './uploads';
    if(!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: function(req, file, cb){
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // serve frontend HTML/JS/CSS

// Data storage (in memory for demo; can later use DB)
let users = [];
let assignments = [];
let exams = [];
let submissions = [];
let classFeed = [];
let library = [];

// Routes

// Sign up
app.post('/signup', (req, res) => {
  const { name, id, pass, role } = req.body;
  if(users.find(u=>u.id===id)) return res.status(400).json({msg:"User exists"});
  users.push({ name, id, pass, role });
  res.json({msg:"Signup success"});
});

// Login
app.post('/login', (req, res) => {
  const { id, pass, role } = req.body;
  const user = users.find(u => u.id===id && u.pass===pass && u.role===role);
  if(!user) return res.status(400).json({msg:"Invalid login"});
  res.json({msg:"Login success", user});
});

// Assignments
app.post('/assignments', upload.single('file'), (req, res) => {
  const { title, student } = req.body;
  const file = req.file ? req.file.filename : null;
  assignments.push({ title, student, file });
  res.json({msg:"Assignment uploaded", assignment: {title, student, file}});
});

app.get('/assignments', (req,res)=>{
  res.json(assignments);
});

// Exams
app.post('/exams', (req,res)=>{
  const { title } = req.body;
  exams.push({ title });
  res.json({msg:"Exam posted", exams});
});

app.get('/exams', (req,res)=>{
  res.json(exams);
});

// Class feed
app.post('/feed', (req,res)=>{
  const { user, text } = req.body;
  classFeed.push({ user, text });
  res.json({msg:"Posted", feed: classFeed});
});

app.get('/feed', (req,res)=>{
  res.json(classFeed);
});

// Stylus save (base64)
app.post('/stylus', (req,res)=>{
  const { student, data } = req.body;
  const buffer = Buffer.from(data.replace(/^data:image\/\w+;base64,/, ""), 'base64');
  const fileName = `uploads/${Date.now()}-${student}.png`;
  fs.writeFileSync(fileName, buffer);
  res.json({msg:"Stylus saved", file: fileName});
});

// Library
app.post('/library', (req,res)=>{
  const { name } = req.body;
  library.push({ name });
  res.json({msg:"Resource added", library});
});

app.get('/library', (req,res)=>{
  res.json(library);
});

// Serve frontend
app.get('/', (req,res)=>{
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Start server
app.listen(port, ()=>{
  console.log(`GreenBook server running on port ${port}`);
});