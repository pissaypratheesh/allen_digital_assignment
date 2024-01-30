import nextConnect from 'next-connect';
import multer from 'multer';
import fs from 'fs';
import cors from 'cors';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

// Set FFmpeg path to the static binary provided by ffmpeg-static
ffmpeg.setFfmpegPath(ffmpegStatic);

// Configure multer for file upload
const upload = multer({ dest: '/tmp' });

// Initialize CORS middleware
const corsMiddleware = cors({
  origin: '*',
  methods: ['POST', 'OPTIONS'], 
  allowedHeaders: ['Content-Type', 'Authorization'], 
  credentials: true,
});


const handler = nextConnect();

handler.use(corsMiddleware);
// Handle OPTIONS method for preflight requests
handler.options('*', (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  // Send response
  res.status(200).end();
});

handler.use(upload.single('video'));

handler.post(async (req, res) => {
  const videoPath = req.file.path;
  const watermarkPath = path.resolve('./public/assets/imgs/watermark.png'); // Updated watermark.png path
  const outputPath = `/tmp/output-${Date.now()}.mp4`;

  ffmpeg(videoPath)
    .input(watermarkPath)
    .complexFilter([
      '[1:v]scale=80:80[wm]', // Scale watermark to 80x80
      '[0:v][wm]overlay=W-w-10:10' // Overlay watermark on the video
    ])
    .input(watermarkPath)
    .save(outputPath)
    .on('end', () => {
      res.status(200);
      const readStream = fs.createReadStream(outputPath);
      readStream.pipe(res);
      readStream.on('close', () => {
        // Delete the temporary files after sending the response
        fs.unlinkSync(videoPath);
        fs.unlinkSync(outputPath);
      });
    })
    .on('error', (err) => {
      console.error('Error:', err);
      res.status(500).json({ error: 'An error occurred while processing the video.' });
      // Delete the temporary files in case of error
      fs.unlinkSync(videoPath);
      fs.unlinkSync(outputPath);
    });
})

    
export const config = {
  api: {
    bodyParser: false, // Disable body parsing; multer will handle it
  },
};

export default handler;
