// Add JS hereconst { onRequest } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } = require("@google/generative-ai");
const sharp = require('sharp'); // Import sharp for image processing

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

exports.analyzeImage = onRequest({ cors: true }, async (req, res) => {
    try {
        // Check if the request has a binary payload
        if (!Buffer.isBuffer(req.rawBody)) {
            throw new Error("Invalid request: Expected binary image data");
        }

        // Process the image using Sharp (optional)
        const processedImageBuffer = await sharp(req.rawBody)
            .toBuffer();

        // Convert the image buffer to base64
        const imageData = processedImageBuffer.toString('base64');

        const fs = require('fs');

        function saveBase64Image(base64Image, filePath) {
            try {
                // Remove the data URI prefix (if present)
                const base64Data = base64Image.replace(/^data:image\/jpeg;base64,/, "");

                // Convert the base64 data to a buffer
                const imageBuffer = Buffer.from(base64Data, 'base64');

                // Write the buffer to a file
                fs.writeFileSync(filePath, imageBuffer);

                console.log(`Image saved to ${filePath}`);
            } catch (error) {
                console.error(`Error saving image: ${error.message}`);
                throw error; // Rethrow the error to handle it in your Cloud Function
            }
        }

        // Save the base64 image to a temporary file (optional, but recommended)
        const tempFilePath = `/tmp/image.jpg`; // Or a more unique name
        saveBase64Image(imageData, tempFilePath); 

        // Converts local file information to a GoogleGenerativeAI.Part object.
        function fileToGenerativePart(path, mimeType) {
            return {
            inlineData: {
                data: Buffer.from(fs.readFileSync(path)).toString("base64"),
                mimeType
            },
            };
        }
        
        // Turn images to Part objects
        const filePart1 = fileToGenerativePart(tempFilePath, "image/jpeg")
        const imageParts = [
            filePart1
        ];

        // Prepare the prompt for Gemini
        const prompt = `Instruction
        Please provide a clear and straightforward score for how handsome I am on a scale from 0 to 100. Briefly describe the basis for your score and the characteristics of my face. The response must be in JSON format and should not include any additional commentary. Regardless of the image quality or other factors, always provide a score and description.

        Examples
        response: {'score': 100, 'reason': 'His chiseled jawline and piercing blue eyes, framed by a head of thick, dark hair, gave him an effortlessly handsome appearance.'}
        response: {'score': 99, 'reason': 'His perfect symmetry, radiant smile, and captivating eyes make him exceptionally handsome.'}
        response: {'score': 90, 'reason': 'With high cheekbones, a well-defined chin, and striking eyes, he exudes a confident and handsome aura.'}
        response: {'score': 85, 'reason': 'This person has symmetrical features, clear skin, and a friendly smile, making him quite handsome.'}
        response: {'score': 78, 'reason': 'His slightly rugged look, combined with expressive eyes and a strong brow, gives him a distinctive and attractive appearance.'}
        response: {'score': 88, 'reason': 'His well-groomed beard, combined with a warm smile and sharp features, make him notably handsome.'}
        response: {'score': 75, 'reason': 'This person has a youthful appearance, bright eyes, and a proportional face, contributing to his handsome look.'}
        response: {'score': 69, 'reason': 'While his features are generally pleasing, minor asymmetries and a less defined jawline slightly detract from his overall handsomeness.'}
        response: {'score': 40, 'reason': 'His face has noticeable imperfections and lacks symmetry, significantly affecting his handsomeness.'}
        response: {'score': 3, 'reason': 'The person’s facial proportions are unbalanced, and he has noticeable blemishes, contributing to a lower attractiveness score.'}
        
        Examples of unwanted response
        {"reason": "The provided image is too dark to see the person's facial features clearly.", "score": 0}
        {"reason": "The angle of the image obscures important facial features, making it difficult to give a score.", "score": 0}
        {"reason": "The image resolution is too low to evaluate the person's appearance properly.", "score": 0}
        
        By clearly instructing the AI to avoid additional commentary and focus on a straightforward score and reason, the responses should become more direct and aligned with your requirements.`;

        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            safetySetting: [
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_UNSPECIFIED, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
            generationConfig: { responseMimeType: "application/json" }
        });

        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        const text = response.text();
        
        // Return the structured response
        res.status(200).json(text);

    } catch (error) {
        console.error("Error analyzing image:", error);
        console.log("Error analyzing image:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});