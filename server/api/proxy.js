import express from 'express';
import axios from 'axios';

const router = express.Router();

router.get('/image', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).send('Missing URL parameter');
    }

    try {
        const response = await axios({
            url: decodeURIComponent(url),
            method: 'GET',
            responseType: 'stream'
        });

        // Forward headers if needed, but usually just Content-Type is enough
        res.set('Content-Type', response.headers['content-type']);
        response.data.pipe(res);
    } catch (error) {
        console.error('Proxy Fetch Error:', error.message);
        res.status(500).send('Error fetching image');
    }
});

export default router;
