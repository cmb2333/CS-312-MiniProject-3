const express = require('express');
const blogRoutes = require('./routes/blogRoutes');
const app = express();
const path = require('path');
const bcrypt = require('bcrypt');
const pool = require('./db');
const session = require('express-session');

// Serve static files for images
app.use(express.static(path.join(__dirname, 'public')));

// Parse URL encoded bodies
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true })); 

// Coming in clutch: https://expressjs.com/en/resources/middleware/session.html
app.use(session({
    secret: 'please',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true } 
}));

// Display databsae entries on page: https://www.geeksforgeeks.org/how-to-connect-sql-server-database-from-javascript-in-the-browser/
// Authentication: https://www.honeybadger.io/blog/javascript-authentication-guide/
app.get('/', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM blogs ORDER BY date_created DESC");

        // Check if user data is available in the session
        const user = req.session && req.session.userId ? req.session : null;
        res.render('index', { posts: result.rows, user: user });

    } catch (err) {
        console.error("Error occurred while fetching posts:", err);
        res.status(500).send("Server error");
    }
});

// SQL and Javascript is my nightmare https://www.w3schools.com/nodejs/nodejs_mysql_update.asp

// Protect the route for creating new post
app.get('/posts/new', requireAuth, (req, res) => {
    res.render('new');
});

// Protect the route for editing existing post
app.get('/posts/edit/:id', requireAuth, async (req, res) => {
    try {
        const postId = req.params.id;
        const result = await pool.query("SELECT * FROM blogs WHERE blog_id = $1", [postId]);
        if (result.rows.length === 0) {
            return res.status(404).send("Post not found");
        }
        res.render('edit', { post: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

// Protect the route for deleting post
app.post('/posts/delete/:id', requireAuth, async (req, res) => {
    try {
        const postId = req.params.id;
        await pool.query("DELETE FROM blogs WHERE blog_id = $1", [postId]);
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

app.get('/signup', (req, res) => {
  res.render('signup'); 
});

app.get('/signin', (req, res) => {
  res.render('signin'); 
});

app.use(blogRoutes);

// Sign up and sign in tutorial: https://medium.com/@shahzarana4/how-to-create-a-secure-login-and-registration-with-node-js-express-js-bcryptjs-and-jsonwebtoken-1eecb8ef80f2
// More Authentication https://www.honeybadger.io/blog/javascript-authentication-guide/

app.post('/signup', async (req, res) => {
    const { name, user_id, password } = req.body;
    try {
        // Check if user ID already exists
        const userExists = await pool.query("SELECT * FROM users WHERE user_id = $1", [user_id]);
        if (userExists.rows.length > 0) {
            return res.status(400).send("User ID already taken.");
        }

        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert new user into the database
        await pool.query("INSERT INTO users (name, user_id, password) VALUES ($1, $2, $3)", [name, user_id, hashedPassword]);

        res.redirect('/signin');

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

app.post('/signin', async (req, res) => {
  const { user_id, password } = req.body;
  try {
      // Retrieve user from database
      const result = await pool.query("SELECT * FROM users WHERE user_id = $1", [user_id]);
      if (result.rows.length === 0) {
          return res.status(401).send("User not found.");
      }

      // Compare hashed passwords
      const user = result.rows[0];
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
          return res.status(401).send("Invalid credentials.");
      }

      // Set user session
      req.session.userId = user.user_id;
      res.redirect('/');

  } catch (err) {
      console.error(err);
      res.status(500).send("Server error");
  }
});

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});

// Require routes to authenticate
function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    } else {
        return res.redirect('/signin');
    }
}

