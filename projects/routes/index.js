var express = require('express');
var router = express.Router();
var authMiddleware = require('../middleware/auth');

/* GET home page. */
router.get('/', authMiddleware.isLoggedIn, function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/logout', (req, res) => {
  req.session.destroy(err => {
      if (err) {
          console.error('Error destroying session:', err);
      }
      res.redirect('/login');
  });
});

module.exports = router;
