const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const mongoose = require('mongoose');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/cognifyz', { useNewUrlParser: true, useUnifiedTopology: true });

// Models
const User = require('./models/User');
const FormData = require('./models/FormData');

// Middleware
app.use(morgan('dev'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
  secret: 'cognifyz_secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: 'mongodb://localhost:27017/cognifyz' })
}));

// Passport setup
passport.use(new LocalStrategy(
  async (username, password, done) => {
    const user = await User.findOne({ username });
    if (!user) return done(null, false, { message: 'Incorrect username.' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return done(null, false, { message: 'Incorrect password.' });
    return done(null, user);
  }
));
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});
app.use(passport.initialize());
app.use(passport.session());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', apiLimiter);

// Routes
app.get('/', (req, res) => {
  res.render('index', { user: req.user });
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.render('register', { error: 'All fields required.' });
  const hash = await bcrypt.hash(password, 10);
  await User.create({ username, password: hash });
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login'
}));

app.get('/form', (req, res) => {
  res.render('form', { user: req.user });
});

app.post('/form', async (req, res) => {
  // Server-side validation
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6) {
    return res.render('form', { error: 'Invalid input.', user: req.user });
  }
  await FormData.create({ name, email, password });
  res.redirect('/data');
});

app.get('/data', async (req, res) => {
  const data = await FormData.find();
  res.render('data', { data, user: req.user });
});

// RESTful API endpoints
app.get('/api/data', async (req, res) => {
  const data = await FormData.find();
  res.json(data);
});

app.post('/api/data', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Invalid input.' });
  const entry = await FormData.create({ name, email, password });
  res.json(entry);
});

// ...external API integration, background jobs, caching, etc...

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});