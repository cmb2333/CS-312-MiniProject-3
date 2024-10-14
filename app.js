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
    cookie: { secure: false } 
}));

// Display databsae entries on page: https://www.geeksforgeeks.org/how-to-connect-sql-server-database-from-javascript-in-the-browser/
// Authentication: https://www.honeybadger.io/blog/javascript-authentication-guide/
app.get('/', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM blogs ORDER BY date_created DESC");

        const user = req.session && req.session.userId ? req.session : null;
        res.render('index', { posts: result.rows, user: req.session.user || null, message: null });

    } catch (err) {
        console.error("Error occurred while fetching posts:", err);
        res.status(500).send("Server error");
    }
});

// SQL and Javascript is my nightmare https://www.w3schools.com/nodejs/nodejs_mysql_update.asp

app.get('/posts/new', requireAuth, (req, res) => {
    res.render('posts/new');
});

// More Javacript and SQL https://www.w3schools.com/nodejs/nodejs_mysql_insert.asp
app.post('/posts/new', requireAuth, async (req, res) => {
    const { title, body } = req.body;

    try {
        await pool.query(
            "INSERT INTO blogs (creator_name, creator_user_id, title, body, date_created) VALUES ($1, $2, $3, $4, NOW())",
            [req.session.user.name, req.session.user.id, title, body]
        );
        res.redirect('/');

    } catch (err) {
        console.error('Error while inserting post:', err);
        res.status(500).send("Server error");
    }
});

// Allow only the user who created the post to edit it
app.get('/posts/edit/:id', requireAuth, async (req, res) => {
    const postId = req.params.id;

    try {
        const result = await pool.query(
            "SELECT * FROM blogs WHERE blog_id = $1 AND creator_user_id = $2", 
            [postId, req.session.userId]
        );

        if (result.rowCount === 0) {
            // User does not have permission
            const postsResult = await pool.query("SELECT * FROM blogs ORDER BY date_created DESC");
            return res.render('index', {
                posts: postsResult.rows,
                user: req.session.user || null,
                message: "You do not have permission to edit this post."
            });
        }
        const post = result.rows[0];
        res.render('posts/edit', { post, user: req.session.user || null, message: null });

    } catch (err) {
        console.error('Error while fetching post for editing:', err);
        res.status(500).send("Server error");
    }
});

app.post('/posts/edit/:id', requireAuth, async (req, res) => {
    const postId = req.params.id;
    const { title, body } = req.body;

    try {
        const result = await pool.query(
            "UPDATE blogs SET title = $1, body = $2 WHERE blog_id = $3 AND creator_user_id = $4",
            [title, body, postId, req.session.userId]
        );

        if (result.rowCount === 0) {
            // No rows updated = user doesnt have permission
            const postsResult = await pool.query("SELECT * FROM blogs ORDER BY date_created DESC");
            return res.render('index', {
                posts: postsResult.rows,
                user: req.session.user || null,
                message: "You do not have permission to edit this post."
            });
        }
        res.redirect('/');

    } catch (err) {
        console.error('Error while updating the post:', err);
        res.status(500).send("Server error");
    }
});

// Allow only the user who created the post to delete it
app.post('/posts/delete/:id', requireAuth, async (req, res) => {
    const postId = req.params.id;

    try {
        const result = await pool.query(
            "DELETE FROM blogs WHERE blog_id = $1 AND creator_user_id = $2",
            [postId, req.session.userId]
        );

        if (result.rowCount === 0) {
            // User does not have permission to delete the post
            const postsResult = await pool.query("SELECT * FROM blogs ORDER BY date_created DESC");
            return res.render('index', {
                posts: postsResult.rows,
                user: req.session.user || null,
                message: "You do not have permission to delete this post."
            });
        }
        res.redirect('/');

    } catch (err) {
        console.error('Error while deleting the post:', err);
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
// Even more Authentication: https://codeshack.io/basic-login-system-nodejs-express-mysql/

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
        req.session.user = {
            id: user.user_id,
            name: user.name
        };
        res.redirect('/');

  } catch (err) {
      console.error(err);
      res.status(500).send("Server error");
  }
});

app.get('/signout', (req, res) => {
    // Remove session by "destroying"
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send("Unable to sign out");
        }
        res.redirect('/');
    });
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