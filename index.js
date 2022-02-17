'use strict'

/**
 * Module dependencies.
 */

const express = require('express');
const hash = require('pbkdf2-password')()
const path = require('path');
const cors = require('cors')
const session = require('express-session');
const bodyParser = require('body-parser')
const uuid = require('uuid').v4

const app = module.exports = express();

// config

// app.set('view engine', 'ejs');
// app.set('views', path.join(__dirname, 'views'));

// middleware

app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(cors())
app.use(bodyParser.json());
app.use(session({
  resave: false, // don't save session if unmodified
  saveUninitialized: false, // don't create session until something stored
  secret: 'shhhh, very secret'
}));

// Session-persisted message middleware

app.use(function(req, res, next){
  var err = req.session.error;
  var msg = req.session.success;
  delete req.session.error;
  delete req.session.success;
  res.locals.message = '';
  next();
});

// dummy database

const users = {}
const chat = []

// when you create a user, generate a salt
// and hash the password ('foobar' is the pass here)

// hash({ password: 'foobar' }, function (err, pass, salt, hash) {
//   if (err) throw err;
//   // store the salt & hash in the "db"
//   users.tj.salt = salt;
//   users.tj.hash = hash;
// });


// Authenticate using our plain-object database of doom!

function createUser (name, email, password) {
    users[name] = {
        name,
        email,
        id: uuid(),
    }

    hash({ password: password }, function (err, pass, salt, hash) {
        if (err) throw err;
        // store the salt & hash in the "db"
        users[name].salt = salt;
        users[name].hash = hash;
      });

      return true
}

function authenticate(name, pass, fn) {
  if (!module.parent) console.log('authenticating %s:%s', name, pass);
  var user = users[name];
  // query the db for the given username
  if (!user) return fn(null, null)
  // apply the same algorithm to the POSTed password, applying
  // the hash against the pass / salt, if there is a match we
  // found the user
  hash({ password: pass, salt: user.salt }, function (err, pass, salt, hash) {
    if (err) return fn(err);
    if (hash === user.hash) return fn(null, user)
    fn(null, null)
  });
}

function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}

app.get('/', function(req, res){
  res.send('<h1>Hello</h1>')
});

app.get('/get-all-chats', (req, res) => {
    res.json({ status: 'success', chat: chat })
})

app.get('/get-chat/:from/:to', (req, res) => {
    let fromID = req.params.from
    let toID = req.params.to

    let userChat = chat.filter(chat => chat.from.includes(fromID) && chat.to.includes(toID))
    res.json({ status: 'success', chat: userChat })
})

app.get('/users', (req, res) => {
    let allUsers = Object.values(users).map(user => ({ id: user.id, name: user.name, email: user.email }))
    res.json({ status: 'success', users: allUsers })
})

app.get('/user/:id', (req, res) => {
    let userId = req.params.id
    let user = Object.values(users).find(user => user.id === userId)
    res.json({ status: 'success', user: user })
})

app.get('/logout', function(req, res){
  // destroy the user's session to log them out
  // will be re-created next request
  req.session.destroy(function(){
    res.redirect('/');
  });
});

app.post('/login', function (req, res, next) {
    console.log(req.body);
  authenticate(req.body.username, req.body.password, function(err, user){
    if (err) {
        return next(err)
    }
    if (user) {
        res.json({ text: 'Successfully logged in', status: 'success', user: users[req.body.username] })
        // Regenerate session when signing in
        // to prevent fixation
        req.session.regenerate(function(){
            // Store the user's primary key
            // in the session store to be retrieved,
            // or in this case the entire user object
            req.session.user = user;
            req.session.success = 'Authenticated as ' + user.name
        });
    } else {
        res.json({ text: 'Login Failed', status: 'failed' })
        req.session.error = 'Authentication failed, please check your '
        + ' username and password.';
    //   res.redirect('/login');
    }
  });
});

app.post('/signup', (req, res) => {
    let data = req.body
    console.log(data);
    let userCreated = createUser(data.username, data.email, data.password)
    if (userCreated) {
        res.json({ text: 'User Created Successfully', status: 'success' })
    } else {
        res.json({ text: 'Signup failed', status: 'failed' })
    }
})

app.post('/chat', (req, res) => {
    let data = req.body
    chat.push(data)
    res.json({ text: 'Sent Chat data', status: 'success' })
})

/* istanbul ignore next */
if (!module.parent) {
  app.listen(process.env.PORT || 5000);
  console.log('Express started on port 3000');
}