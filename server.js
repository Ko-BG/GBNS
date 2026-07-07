const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static assets from the root directory
app.use(express.static(path.join(__dirname)));

// Main Route
app.get('/', (path, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`🚀 Padel Erbil Hub running successfully!`);
    console.log(`🌐 Open your browser at: http://localhost:${PORT}`);
    console.log(`===================================================`);
});
