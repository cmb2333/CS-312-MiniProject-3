const express = require('express');
const router = express.Router();

// Thanks Express.js - https://expressjs.com/en/guide/routing.html

// Store posts
let posts = []; 

// Route to display form
router.get('/posts/new', (req, res) => {
  res.render('posts/new');
});

// Route to handle form submission
router.post('/posts', (req, res) => {
  const post = {
    id: posts.length + 1,
    name: req.body.name,
    title: req.body.title,
    content: req.body.content,
    postedOn: new Date()
  };
  posts.push(post);
  res.redirect('/');
});

// Route to handle displaying posts on home page
router.get('/', (req, res) => {
  res.render('index', { posts: posts });
});

// Route to edit post by ID
router.get('/posts/edit/:id', (req, res) => {
  const post = posts.find(post => post.id === parseInt(req.params.id));
  if (!post) {
    return res.status(404).send('Post with the given ID was not found');
  }
  res.render('posts/edit', { post });
});

// Handle edit POST request
router.post('/posts/edit/:id', (req, res) => {
  const post = posts.find(post => post.id === parseInt(req.params.id));
  if (!post) {
    return res.status(404).send('Post with the given ID was not found');
  }
  post.name = req.body.name;
  post.title = req.body.title;
  post.content = req.body.content;
  res.redirect('/');
});

// Route to hanlde the deletion of posts
router.post('/posts/delete/:id', (req, res) => {
  const postIndex = posts.findIndex(post => post.id === parseInt(req.params.id));
  if (postIndex > -1) {
    posts.splice(postIndex, 1);
  }
  res.redirect('/');
});

module.exports = router;
