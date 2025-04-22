
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const campaignSchema = new mongoose.Schema({
  title: String,
  brand: String,
  barcodeId: String,
  timestamp: String,
  frequency: String,
  url: String,
  videoFile: String,
});

const counterSchema = new mongoose.Schema({
  name: String,
  value: Number,
});

const Campaign = mongoose.model('Campaign', campaignSchema);
const Counter = mongoose.model('Counter', counterSchema);

const getNextToneId = async () => {
  const counter = await Counter.findOneAndUpdate(
    { name: 'tone' },
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  );
  return `SONIC${String(counter.value).padStart(3, '0')}`;
};

app.get('/campaigns', async (req, res) => {
  const campaigns = await Campaign.find();
  res.json(campaigns);
});

app.post('/campaigns', async (req, res) => {
  const newId = await getNextToneId();
  const campaign = new Campaign({ ...req.body, barcodeId: req.body.barcodeId || newId });
  await campaign.save();
  res.json(campaign);
});

const upload = multer({ dest: 'uploads/' });

app.post('/encode', upload.single('video'), async (req, res) => {
  const { title, timestamp, frequency } = req.body;
  const inputPath = req.file.path;
  const tonePath = `uploads/tone_${Date.now()}.wav`;
  const outputPath = `uploads/encoded_${Date.now()}.mp4`;

  const generateTone = `ffmpeg -f lavfi -i sine=frequency=${frequency}:duration=0.5 -y ${tonePath}`;
  const mergeCommand = `ffmpeg -i ${inputPath} -i ${tonePath} -filter_complex "[0:a][1:a]amix=inputs=2:duration=first[aout]" -map 0:v -map "[aout]" -c:v copy -y ${outputPath}`;


  exec(generateTone, (err) => {
    if (err) return res.status(500).send("Tone generation failed");

    exec(mergeCommand, (err) => {
      if (err) return res.status(500).send("Encoding failed");

      res.download(outputPath, \`\${title.replace(/\s+/g, '_')}_encoded.mp4\`);
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
