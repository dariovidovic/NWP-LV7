var express = require('express');
var router = express.Router();
mongoose = require('mongoose');
var bcrypt = require('bcrypt');
var User = mongoose.model('User');


router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

router.get('/index', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

/*-----Register ruta-----*/
router.get('/register', (req, res) => {
  const successMessage = req.session.successMessage;
  const errorMessage = req.session.errorMessage;

  req.session.successMessage = null;
  req.session.errorMessage = null;

  res.render('users/register', {successMessage: successMessage, errorMessage: errorMessage});
});

/*-----Login ruta-----*/
router.get('/login', (req, res) => {

  const successMessage = req.session.successMessage;
    const errorMessage = req.session.errorMessage;

    req.session.successMessage = null;
    req.session.errorMessage = null;

  res.render('users/login', {successMessage: successMessage, errorMessage: errorMessage});
});


router.post('/register',async (req, res) => {

  try {

    const { firstName, lastName, email, password, confirmPassword } = req.body;

    if (password.length < 8) {
      req.session.errorMessage = 'Password must be at least 8 characters long';
      return res.redirect('/register');
    }

    if (password !== confirmPassword) {
      req.session.errorMessage = 'Passwords do not match';
      return res.redirect('/register');
    }

    /*-----Provjera postoji li vec korisnik u bazi-----*/
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).send('Email is already registered');
    }

    /*-----Password hashing-----*/
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    /*-----Kreiranje te spremanje korisnika u bazu-----*/
    const newUser = new User({
      firstName: firstName,
      lastName: lastName,
      email: email,
      password: hashedPassword
    });

    await newUser.save();

    req.session.successMessage = 'Registration successful';
    res.redirect('/');
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).send('An error occurred during registration: ' + error.message);
  }
});


router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      req.session.errorMessage = 'Invalid email or password';
      return res.redirect('/login');
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      req.session.errorMessage = 'Invalid email or password';
      return res.redirect('/login');
    }

    req.session.userId = user._id;
    req.session.userEmail = user.email;
    req.session.firstName = user.firstName;
    req.session.lastName = user.lastName;

    res.redirect('/index');
  } catch (error) {
    console.error('Error logging in:', error);
    req.session.errorMessage = 'An error occurred during login';
    res.redirect('/login');
  }
});


module.exports = router;
