const express = require('express');
const blogRoutes = require('./routes/blogRoutes');
const app = express();
const path = require('path');

// Serve static files for images
app.use(express.static(path.join(__dirname, 'public')));

// Parse URL encoded bodies
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));  

app.use(blogRoutes);

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
