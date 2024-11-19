require("dotenv").config();
const express = require("express");
const multer = require("multer");
const PDFdocument = require("pdfkit");
const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 5000;

const upload = multer({ dest: "upload/" });
app.use(express.json({ limit: "10mb" }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API);

app.use(express.static("public"));

//routes
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (process.env.USE_MOCK === "true") {
      // Mock implementation
      if (!req.file) {
        return res.status(400).json({ error: "Please upload an image" });
      }
      const imagePath = req.file.path;
      const mockResponse = {
        result:
          "Mocked analysis: The plant is a healthy Aloe Vera. Care tips: Avoid overwatering. Place in bright, indirect sunlight for best growth. Interesting fact: Aloe Vera has been used for centuries for its medicinal properties.",
        image: `data:${req.file.mimetype};base64,<mock_base64_data>`,
      };

      // Delete the uploaded file
      fs.unlink(imagePath, (err) => {
        if (err) console.error("Failed to delete file:", err);
      });

      return res.json(mockResponse);
    }

    //real implementation
    if (!req.file) {
      return res.status(400).json({ error: "please upload an image" });
    }
    const imagePath = req.file.path;
    const imageData = await fsPromises.readFile(imagePath, {
      encoding: "base64",
    });
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });
    const result = await model.generateContent([
      "Analyze this plant image and provide detailed analysis of its species, health, and care recommendations, its characteristics, care instructions, and any interesting facts. Please provide the response in plain text without using any markdown formatting.",
      {
        inlineData: {
          mimeType: req.file.mimetype,
          data: imageData,
        },
      },
    ]);
    const plantInfo = result.response.text();
    await fsPromises.unlink(imagePath);
    res.json({
      result: plantInfo,
      image: `data:${req.file.mimetype}:base64,${imageData}`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//download pdf

// app.post("/download", express.json(), async (req, res) => {
//   // res.json({ success: true });
//   const { result, image } = req.body;
//   try {
//     const reportsDir = path.join(__dirname, "report");
//     await fsPromises.mkdir(reportsDir, { recursive: true });
//     //generate pdf
//     const filename = `plant_analysis_report_${Date.now()}.pdf`;
//     const filePath = path.join(reportsDir, filename);
//     const writeStream = fs.createWriteStream(filePath);
//     const doc = new PDFdocument();
//     // add content to pdf
//     doc.pipe(writeStream);
//     doc.fontSize(24).text("plant Analysis Report", {
//       align: "center",
//     });
//     doc.moveDown();
//     doc.fontSize(24).text(`date: ${new Date().toLocaleDateString()}`);
//     doc.moveDown();
//     doc.fontSize(24).text(result, { align: "left" });

//     //insert Image
//     if (image) {
//       const imageRegex = /^data:image\/(png|jpeg|jpg|gif);base64,/;
//       const match = image.match(imageRegex);
//       if (match) {
//         const base64 = image.replace(imageRegex, ""); // Remove base64 prefix
//         const buffer = Buffer.from(base64, "base64");

//         doc.moveDown();
//         doc.image(buffer, {
//           fit: [500, 300],
//           align: "center",
//           valign: "center",
//         });
//       } else {
//         throw new Error("Unsupported image format.");
//       }
//     }

//     doc.end();
//     await new Promise((resolve, reject) => {
//       writeStream.on("finish", resolve);
//       writeStream.on("error", reject);
//     });
//     res.download(filePath, (err) => {
//       if (err) {
//         res.status(500).json({ error: "Error Downloading the PDF report" });
//       }
//       fsPromises.unlink(filePath);
//     });
//   } catch (error) {
//     console.error("Error generating pdf report", error);
//     res
//       .status(500)
//       .json({ error: "an error occurred while generating the PDF report" });
//   }
// });

app.post("/download", express.json(), async (req, res) => {
  const { result, image } = req.body;
  try {
    //Ensure the reports directory exists
    const reportsDir = path.join(__dirname, "reports");
    await fsPromises.mkdir(reportsDir, { recursive: true });
    //generate pdf
    const filename = `plant_analysis_report_${Date.now()}.pdf`;
    const filePath = path.join(reportsDir, filename);
    const writeStream = fs.createWriteStream(filePath);
    const doc = new PDFdocument();
    doc.pipe(writeStream);
    // Add content to the PDF
    doc.fontSize(24).text("Plant Analysis Report", {
      align: "center",
    });
    doc.moveDown();
    doc.fontSize(24).text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();
    doc.fontSize(14).text(result, { align: "left" });
    //insert image to the pdf
    if (image) {
      const base64Data = image.replace("data:image/jpeg:base64,", "");
      const buffer = Buffer.from(base64Data, "base64");
      doc.moveDown();
      doc.image(buffer, {
        fit: [500, 300],
        align: "center",
        valign: "center",
      });
    }
    doc.end();
    //wait for the pdf to be created
    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });
    res.download(filePath, (err) => {
      if (err) {
        res.status(500).json({ error: "Error downloading the PDF report" });
      }
      fsPromises.unlink(filePath);
    });
  } catch (error) {
    console.error("Error generating PDF report:", error);
    res
      .status(500)
      .json({ error: "An error occurred while generating the PDF report" });
  }
});

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});
