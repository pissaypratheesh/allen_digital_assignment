import nextConnect from "next-connect";
import multer from "multer";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

// Set FFmpeg path to the static binary provided by ffmpeg-static
ffmpeg.setFfmpegPath(ffmpegStatic);


// CORS middleware helper function
const allowCors = (fn) => async (req, res) => {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  return await fn(req, res);
};

// Initialize next-connect handler
const handler = nextConnect();
const upload = multer({ dest: '/tmp' });

// Initialize CORS middleware
const corsMiddleware = cors({
  // Configure CORS options as needed
  origin: '*', // Allow all origins, you can restrict this in production
  methods: ['POST', 'OPTIONS'], // Allow POST and OPTIONS methods
  allowedHeaders: ['Content-Type', 'Authorization'], // You can add any headers that you want to support
  credentials: true, // This allows cookies to be sent with the request, if needed
});


handler.use(corsMiddleware);

// Handle OPTIONS method for preflight requests
// Apply CORS middleware to the handler
handler.use(allowCors);

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

export default allowCors(handler);
