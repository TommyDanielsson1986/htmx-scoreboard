import express from 'express';
const app = express();

// Set static folder
app.use(express.static('public'));

// Parse URL-endcoded bodies (as sent by html forms)
app.use(express.urlencoded({ extended: true }));

// Parse JSON bodies (as sent by API client)
app.use(express.json());

// GET request
app.get('/users', async (req, res) => {
    res.send('Hello user')
})

app.get('/dashboard', async (req, res) => {
    res.send('Hello dashboard')
})

// POST request
app.post('/convert', async(req, res) => {
    res.send('helloworld')
})
// Start the server
app.listen(5000, () => {
    console.log('Server listning on port 5000');
})