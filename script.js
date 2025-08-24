// ===================================================================================
//
// 🚨 DANGER: EXPOSING YOUR API KEY IN CLIENT-SIDE CODE IS A SEVERE SECURITY RISK! 🚨
//
// Anyone can view this code and steal your key. For a real application, this API
// call MUST be made from a backend server where the key can be kept secret.
// This implementation is for educational purposes only, as per the request.
//
// ===================================================================================

const OPENROUTER_API_KEY = "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";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

// OCR.space API key (free tier - register at ocr.space for your own key)
const OCR_API_KEY = "K81080572688957"; // Replace with your actual key
const OCR_API_URL = "https://api.ocr.space/parse/image";

// DOM Elements
const loadingOverlay = document.getElementById('loading-overlay');
const errorMessage = document.getElementById('error-message');
const startScreen = document.getElementById('start-screen');
const quizScreen = document.getElementById('quiz-screen');
const scoreScreen = document.getElementById('score-screen');

const settingsForm = document.getElementById('quiz-settings-form');
const topicInput = document.getElementById('topic');
const numQuestionsInput = document.getElementById('num-questions');
const difficultySelect = document.getElementById('difficulty');
const languageSelect = document.getElementById('language');
const timerDurationInput = document.getElementById('timer-duration');
const startBtn = document.getElementById('start-btn');

const progressBar = document.getElementById('progress-bar');
const questionCounter = document.getElementById('question-counter');
const scoreCounter = document.getElementById('score-counter');
const timerDisplay = document.getElementById('timer');
const questionElement = document.getElementById('question');
const answerButtonsElement = document.getElementById('answer-buttons');
const hintBtn = document.getElementById('hint-btn');
const nextBtn = document.getElementById('next-btn');

const finalScoreElement = document.getElementById('final-score');
const scoreFeedbackElement = document.getElementById('score-feedback');
const playAgainBtn = document.getElementById('play-again-btn');

// Additional DOM Elements
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const imageUpload = document.getElementById('image-upload');
const imagePreview = document.getElementById('image-preview');
const previewImg = document.getElementById('preview-img');
const removeImgBtn = document.getElementById('remove-img');
const copyQuizBtn = document.getElementById('copy-quiz-btn');
const shareQuizBtn = document.getElementById('share-quiz-btn');

// State Variables
let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let timer;
let timeLeft;
let quizSettings = {};

// Additional state variables
let uploadedImage = null;
let extractedText = null; // To store text extracted from the image
let quizData = null; // Stores the complete quiz data for sharing

// --- Event Listeners ---
settingsForm.addEventListener('submit', startQuiz);
nextBtn.addEventListener('click', handleNextButton);
playAgainBtn.addEventListener('click', resetAndRestart);
hintBtn.addEventListener('click', showHint);

tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.target));
});

imageUpload.addEventListener('change', handleImageUpload);
removeImgBtn.addEventListener('click', removeImage);
copyQuizBtn.addEventListener('click', copyQuiz);
shareQuizBtn.addEventListener('click', shareQuiz);

// --- Main Functions ---
function showScreen(screen) {
    [startScreen, quizScreen, scoreScreen].forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
}

async function startQuiz(e) {
    e.preventDefault();
    errorMessage.classList.add('hidden');
    
    // Get selected question types
    const selectedQuestionTypes = Array.from(
        document.querySelectorAll('input[name="question-type"]:checked')
    ).map(input => input.value);
    
    if (selectedQuestionTypes.length === 0) {
        showError('Please select at least one question type');
        return;
    }
    
    // Check if we have a topic or uploaded image
    const isTopicTab = document.getElementById('topic-tab').classList.contains('hidden') === false;
    if (isTopicTab && !topicInput.value.trim()) {
        showError('Please enter a quiz topic');
        return;
    }
    
    if (!isTopicTab && !uploadedImage) {
        showError('Please upload an image or switch to topic mode');
        return;
    }
    
    loadingOverlay.classList.remove('hidden');
    startBtn.disabled = true;
    
    try {
        // Process image if needed
        if (!isTopicTab && uploadedImage) {
            try {
                // Extract text from the image first
                extractedText = await extractTextFromImage(uploadedImage);
                
                if (!extractedText || extractedText.trim() === '') {
                    throw new Error('No text could be extracted from the image. Please try a clearer image or enter a topic instead.');
                }
                
                console.log('Extracted text:', extractedText);
            } catch (error) {
                throw new Error(`Image text extraction failed: ${error.message}`);
            }
        }
        
        quizSettings = {
            useImage: !isTopicTab,
            topic: isTopicTab ? topicInput.value : null,
            imageData: !isTopicTab ? uploadedImage : null,
            extractedText: !isTopicTab ? extractedText : null,
            questionTypes: selectedQuestionTypes,
            numQuestions: parseInt(numQuestionsInput.value, 10),
            difficulty: difficultySelect.value,
            language: languageSelect.value,
            timerDuration: parseInt(timerDurationInput.value, 10),
            hintsEnabled: document.querySelector('input[name="hint-option"]:checked').value === 'enable'
        };
        
        await generateQuestionsWithAI();
        if (questions && questions.length > 0) {
            currentQuestionIndex = 0;
            score = 0;
            scoreCounter.textContent = `Score: 0`;
            showScreen(quizScreen);
            showQuestion();
        } else {
            throw new Error("The AI did not return any questions. Please try a different topic or settings.");
        }
    } catch (error) {
        showError(error.message);
    } finally {
        loadingOverlay.classList.add('hidden');
        startBtn.disabled = false;
    }
}

async function generateQuestionsWithAI() {
    const { 
        useImage, 
        topic,
        extractedText,
        questionTypes, 
        numQuestions, 
        difficulty, 
        language 
    } = quizSettings;

    let promptContent = '';
    
    if (useImage && extractedText) {
        promptContent = `Generate a ${numQuestions}-question quiz based on the following text that was extracted from an image:\n\n"${extractedText}"\n\nUse this text content to create relevant questions.`;
    } else {
        promptContent = `Generate a ${numQuestions}-question quiz about "${topic}".`;
    }
    
    // Construct question type instructions
    let questionTypeInstructions = '';
    const typesCount = questionTypes.length;
    const questionsPerType = Math.floor(numQuestions / typesCount);
    const remainder = numQuestions % typesCount;
    
    let distribution = {};
    questionTypes.forEach((type, index) => {
        distribution[type] = questionsPerType + (index < remainder ? 1 : 0);
    });
    
    questionTypeInstructions = "Include the following question types: ";
    for (const [type, count] of Object.entries(distribution)) {
        if (count > 0) {
            questionTypeInstructions += `${count} ${type} questions, `;
        }
    }
    questionTypeInstructions = questionTypeInstructions.slice(0, -2) + ".";

    // Improved prompt with stronger JSON formatting instructions
    const prompt = `
        ${promptContent}
        ${questionTypeInstructions}
        The difficulty level must be "${difficulty}".
        The quiz must be entirely in the "${language}" language.

        EXTREMELY IMPORTANT: You MUST format your entire response as ONLY a valid JSON array of objects.
        Do not include any explanatory text, comments, or markdown formatting like \`\`\`json.
        Do not start with "Here's a quiz" or any other text.
        
        Start your response with [ and end with ], making sure the entire response is valid JSON.
        
        Each object in the array must have this exact structure:
        {
          "question": "The question text in ${language}",
          "type": "multiple-choice|true-false|open-ended",
          "options": ["An incorrect option", "Another incorrect option", "The correct option", "A third incorrect option"],
          "correctAnswer": "The exact text of the correct option"
        }

        For true/false questions, options should be ["True", "False"] and correctAnswer should be either "True" or "False".
        For open-ended questions, options should be [] (empty array) and correctAnswer should contain the expected answer.

        For multiple choice questions, ensure the "correctAnswer" value is always one of the strings present in the "options" array.
        Shuffle the position of the correct answer within the "options" array for each question.
    `;

    try {
        let messages = [{ role: "user", content: prompt }];
        
        // Try multiple API approaches
        let response;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
            attempts++;
            
            try {
                console.log(`API attempt ${attempts}...`);
                
                // Different header configurations for each attempt
                let headers;
                if (attempts === 1) {
                    headers = {
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': window.location.origin,
                        'X-Title': 'Interactive Quiz Generator'
                    };
                } else if (attempts === 2) {
                    headers = {
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json'
                    };
                } else {
                    headers = {
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                        'Origin': window.location.origin
                    };
                }
                
                response = await fetch(API_URL, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        model: "meta-llama/llama-3.1-70b-instruct",
                        messages: messages,
                        temperature: 0.7,
                        max_tokens: 2048
                    })
                });
                
                if (response.ok) {
                    console.log(`API attempt ${attempts} succeeded!`);
                    break;
                } else {
                    const errorData = await response.json().catch(() => null);
                    console.error(`Attempt ${attempts} failed:`, errorData);
                    
                    if (attempts === maxAttempts) {
                        throw new Error(errorData?.error?.message || `API Error: ${response.status}`);
                    }
                }
            } catch (fetchError) {
                console.error(`Fetch attempt ${attempts} failed:`, fetchError);
                if (attempts === maxAttempts) {
                    throw fetchError;
                }
            }
        }

        if (!response || !response.ok) {
            throw new Error("All API attempts failed");
        }

        const data = await response.json();
        const llmResponse = data.choices[0].message.content;
        
        // Log the raw response for debugging
        console.log("API Response:", llmResponse);
        
        // Try to extract JSON from the response if it's not pure JSON
        let jsonString = llmResponse;
        
        // Find JSON array opening and closing brackets if response contains extra text
        const jsonStartIndex = llmResponse.indexOf('[');
        const jsonEndIndex = llmResponse.lastIndexOf(']') + 1;
        
        if (jsonStartIndex >= 0 && jsonEndIndex > jsonStartIndex) {
            jsonString = llmResponse.substring(jsonStartIndex, jsonEndIndex);
        }
        
        try {
            const parsedQuestions = JSON.parse(jsonString);
            
            // Validate the parsed questions
            if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
                throw new Error("Invalid questions format returned");
            }
            
            // Add additional validation for each question
            const validatedQuestions = parsedQuestions.filter(q => {
                return q.question && 
                       (q.type === 'multiple-choice' || q.type === 'true-false' || q.type === 'open-ended') &&
                       (q.type !== 'open-ended' ? Array.isArray(q.options) && q.options.length > 0 : true) &&
                       q.correctAnswer !== undefined;
            });
            
            if (validatedQuestions.length === 0) {
                throw new Error("No valid questions found in the response");
            }
            
            questions = validatedQuestions.map(q => ({
                question: q.question,
                type: q.type || 'multiple-choice',
                answers: q.options || [],
                correct_answer: q.correctAnswer
            }));
            
            // Store the complete quiz for sharing
            quizData = {
                settings: quizSettings,
                questions: questions
            };
            
        } catch (parseError) {
            console.error("JSON parsing error:", parseError);
            console.log("Raw response that failed to parse:", llmResponse);
            
            // If JSON parsing fails, try a different model as fallback
            console.log("Trying fallback model...");
            return await tryFallbackModel(prompt);
        }

    } catch (error) {
        console.error("Error generating quiz with AI:", error);
        
        // Try fallback model if primary fails
        console.log("Primary model failed, trying fallback...");
        return await tryFallbackModel(prompt);
    }
}

// Fallback function to try a different model
async function tryFallbackModel(prompt) {
    try {
        console.log("Attempting fallback model...");
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "microsoft/wizardlm-2-8x22b", // Different model as fallback
                messages: [{ role: "user", content: prompt }],
                temperature: 0.8,
                max_tokens: 1500
            })
        });

        if (!response.ok) {
            throw new Error(`Fallback model failed: ${response.status}`);
        }

        const data = await response.json();
        const llmResponse = data.choices[0].message.content;
        
        console.log("Fallback API Response:", llmResponse);
        
        // Try to parse the fallback response
        let jsonString = llmResponse;
        const jsonStartIndex = llmResponse.indexOf('[');
        const jsonEndIndex = llmResponse.lastIndexOf(']') + 1;
        
        if (jsonStartIndex >= 0 && jsonEndIndex > jsonStartIndex) {
            jsonString = llmResponse.substring(jsonStartIndex, jsonEndIndex);
        }
        
        const parsedQuestions = JSON.parse(jsonString);
        
        if (Array.isArray(parsedQuestions) && parsedQuestions.length > 0) {
            questions = parsedQuestions.map(q => ({
                question: q.question,
                type: q.type || 'multiple-choice',
                answers: q.options || [],
                correct_answer: q.correctAnswer
            }));
            
            quizData = {
                settings: quizSettings,
                questions: questions
            };
            
            console.log("Fallback model succeeded!");
            return;
        } else {
            throw new Error("Fallback model returned invalid data");
        }
        
    } catch (fallbackError) {
        console.error("Fallback model also failed:", fallbackError);
        
        // Last resort: Try with OpenAI-compatible endpoint
        return await tryOpenAIFallback();
    }
}

// OpenAI-style fallback
async function tryOpenAIFallback() {
    try {
        console.log("Trying OpenAI-compatible fallback...");
        
        // Simplified prompt for better compatibility
        const simplePrompt = `Create ${quizSettings.numQuestions} quiz questions about "${quizSettings.topic}". Return only a JSON array with this format:
[{"question":"Your question here","type":"multiple-choice","options":["A","B","C","D"],"correctAnswer":"A"}]`;
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "openai/gpt-3.5-turbo",
                messages: [{ role: "user", content: simplePrompt }],
                temperature: 0.7
            })
        });

        if (response.ok) {
            const data = await response.json();
            const content = data.choices[0].message.content;
            
            try {
                const parsed = JSON.parse(content.replace(/```json|```/g, ''));
                if (Array.isArray(parsed) && parsed.length > 0) {
                    questions = parsed.map(q => ({
                        question: q.question,
                        type: q.type || 'multiple-choice',
                        answers: q.options || [],
                        correct_answer: q.correctAnswer
                    }));
                    
                    quizData = { settings: quizSettings, questions: questions };
                    console.log("OpenAI fallback succeeded!");
                    return;
                }
            } catch (e) {
                console.error("OpenAI fallback parse error:", e);
            }
        }
        
        throw new Error("All fallback attempts failed");
        
    } catch (error) {
        console.error("Final fallback failed:", error);
        throw new Error("Unable to generate questions with AI. Please check your internet connection and try again.");
    }
}

// Improve the OCR function to handle short text better
async function extractTextFromImage(imageData) {
    try {
        // Create form data for OCR API request
        const formData = new FormData();
        
        // Convert base64 to blob for the form data
        const base64Response = await fetch(imageData);
        const blob = await base64Response.blob();
        
        formData.append('file', blob, 'image.jpg');
        formData.append('apikey', OCR_API_KEY);
        formData.append('language', 'eng'); // English OCR
        formData.append('isOverlayRequired', 'false');
        formData.append('iscreatesearchablepdf', 'false');
        formData.append('issearchablepdfhidetextlayer', 'false');
        formData.append('scale', 'true'); // Add scaling option for better results
        formData.append('detectOrientation', 'true'); // Detect text orientation
        
        const ocrResponse = await fetch(OCR_API_URL, {
            method: 'POST',
            body: formData,
        });
        
        if (!ocrResponse.ok) {
            throw new Error(`OCR API error: ${ocrResponse.status}`);
        }
        
        const ocrData = await ocrResponse.json();
        
        if (ocrData.OCRExitCode !== 1) {
            throw new Error(`OCR processing error: ${ocrData.ErrorMessage || 'Unknown error'}`);
        }
        
        // Extract text from response
        let extractedText = '';
        if (ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
            extractedText = ocrData.ParsedResults.map(result => result.ParsedText).join('\n');
        }
        
        if (!extractedText || extractedText.trim() === '') {
            throw new Error('No text found in the image. Please try a clearer image with visible text.');
        }
        
        // Log the extracted text for debugging
        console.log('Raw extracted text:', extractedText);
        
        // Clean up the extracted text - remove excessive spaces and line breaks
        extractedText = extractedText.replace(/\s+/g, ' ').trim();
        
        // Check if the text is too short
        if (extractedText.trim().length < 15) {
            throw new Error('The extracted text is too short. Please use an image with more readable text.');
        }
        
        return extractedText;
    } catch (error) {
        console.error('OCR error:', error);
        throw new Error(`Failed to extract text: ${error.message}`);
    }
}

function showQuestion() {
    resetState();
    const currentQuestion = questions[currentQuestionIndex];
    
    questionElement.textContent = currentQuestion.question; 
    questionCounter.textContent = `Question ${currentQuestionIndex + 1} of ${questions.length}`;
    progressBar.style.width = `${((currentQuestionIndex + 1) / questions.length) * 100}%`;

    if (currentQuestion.type === 'multiple-choice' || currentQuestion.type === 'true-false') {
        const shuffledAnswers = [...currentQuestion.answers].sort(() => Math.random() - 0.5);

        shuffledAnswers.forEach(answer => {
            const button = document.createElement('button');
            button.innerHTML = `<span>${answer}</span>`; // Wrap text in span for icon placement
            button.classList.add('btn');
            if (answer === currentQuestion.correct_answer) {
                button.dataset.correct = true;
            }
            button.addEventListener('click', selectAnswer);
            answerButtonsElement.appendChild(button);
        });
    } else if (currentQuestion.type === 'open-ended') {
        const textArea = document.createElement('textarea');
        textArea.placeholder = 'Type your answer here...';
        textArea.classList.add('open-ended-input');
        answerButtonsElement.appendChild(textArea);
        
        const submitButton = document.createElement('button');
        submitButton.textContent = 'Submit Answer';
        submitButton.classList.add('btn', 'btn-primary', 'submit-answer');
        submitButton.addEventListener('click', () => checkOpenEndedAnswer(textArea.value));
        answerButtonsElement.appendChild(submitButton);
    }

    if (quizSettings.hintsEnabled && currentQuestion.type !== 'open-ended') {
        hintBtn.classList.remove('hidden');
        hintBtn.disabled = false;
    }

    startTimer();
}

function startTimer() {
    timeLeft = quizSettings.timerDuration;
    timerDisplay.textContent = `Time: ${timeLeft}`;
    clearInterval(timer); 
    timer = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = `Time: ${timeLeft}`;
        if (timeLeft <= 0) {
            clearInterval(timer);
            handleTimeUp();
        }
    }, 1000);
}

function handleTimeUp() {
    Array.from(answerButtonsElement.children).forEach(button => {
        setStatusClass(button, button.dataset.correct);
        button.disabled = true;
    });
    nextBtn.classList.remove('hidden');
    hintBtn.classList.add('hidden');
}

function selectAnswer(e) {
    clearInterval(timer);
    const selectedButton = e.currentTarget;
    const isCorrect = selectedButton.dataset.correct === 'true';

    if (isCorrect) {
        score++;
        scoreCounter.textContent = `Score: ${score}`;
    }

    Array.from(answerButtonsElement.children).forEach(button => {
        setStatusClass(button, button.dataset.correct);
        button.disabled = true;
    });

    if (questions.length > currentQuestionIndex + 1) {
        nextBtn.classList.remove('hidden');
    } else {
        setTimeout(showFinalScore, 1500); 
    }
    
    hintBtn.classList.add('hidden');
}

function handleNextButton() {
    currentQuestionIndex++;
    showQuestion();
}

function showFinalScore() {
    showScreen(scoreScreen);
    const scorePercent = Math.round((score / questions.length) * 100);
    finalScoreElement.textContent = `You scored ${score} out of ${questions.length} (${scorePercent}%)`;

    let feedback = '';
    if (scorePercent === 100) feedback = "Flawless Victory! You're an absolute genius! 🏆";
    else if (scorePercent >= 75) feedback = "Excellent! You have a deep knowledge of this topic. 🎉";
    else if (scorePercent >= 50) feedback = "Good job! A very respectable score. 👍";
    else feedback = "Nice try! Every quiz is a learning opportunity. 💪";
    scoreFeedbackElement.textContent = feedback;
}

function showHint() {
    const incorrectButtons = Array.from(answerButtonsElement.children).filter(btn => !btn.dataset.correct);
    if (incorrectButtons.length > 1) {
        const buttonToDisable = incorrectButtons[Math.floor(Math.random() * incorrectButtons.length)];
        buttonToDisable.style.visibility = 'hidden';
        hintBtn.disabled = true;
    }
}

function resetAndRestart() {
    showScreen(startScreen);
}

function showError(message) {
    errorMessage.textContent = `⚠️ Error: ${message}`;
    errorMessage.classList.remove('hidden');
}

// --- Utility Functions ---
function resetState() {
    nextBtn.classList.add('hidden');
    hintBtn.classList.add('hidden');
    answerButtonsElement.innerHTML = '';
}

function setStatusClass(button, isCorrect) {
    if (isCorrect) {
        button.classList.add('correct');
        button.innerHTML += ' <span>✓</span>';
    } else {
        button.classList.add('incorrect');
        button.innerHTML += ' <span>✗</span>';
    }
}

function switchTab(targetId) {
    tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.target === targetId);
    });
    
    tabContents.forEach(content => {
        content.classList.toggle('hidden', content.id !== targetId);
    });
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.match('image.*')) {
        showError('Please select an image file (JPEG, PNG, etc.)');
        imageUpload.value = ''; // Clear the input
        return;
    }
    
    // Add file size validation
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showError('Image file is too large. Please select an image smaller than 5MB.');
        imageUpload.value = ''; // Clear the input
        return;
    }
    
    // Update UI to show loading state
    const uploadTab = document.getElementById('upload-tab');
    let statusElement = uploadTab.querySelector('.upload-status');
    
    if (!statusElement) {
        statusElement = document.createElement('p');
        statusElement.className = 'upload-status';
        uploadTab.appendChild(statusElement);
    }
    
    statusElement.textContent = 'Processing image...';
    statusElement.classList.add('processing');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        previewImg.src = e.target.result;
        imagePreview.classList.remove('hidden');
        uploadedImage = e.target.result;
        
        // Show a hint about image uploads
        if (!uploadTab.querySelector('.upload-hint')) {
            const hint = document.createElement('p');
            hint.className = 'upload-hint';
            hint.textContent = 'For best results, use clear images with legible text.';
            uploadTab.appendChild(hint);
        }
        
        statusElement.textContent = 'Image ready for processing';
        statusElement.classList.remove('processing');
        statusElement.classList.add('success');
    };
    reader.onerror = function() {
        showError('Error reading the image file. Please try another image.');
        statusElement.textContent = 'Error processing image';
        statusElement.classList.remove('processing');
        statusElement.classList.add('error');
        imageUpload.value = ''; // Clear the input
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    imageUpload.value = '';
    imagePreview.classList.add('hidden');
    uploadedImage = null;
}

function checkOpenEndedAnswer(userAnswer) {
    clearInterval(timer);
    const currentQuestion = questions[currentQuestionIndex];
    
    // Simple check for now - in a real app you might want more sophisticated matching
    const correctAnswer = currentQuestion.correct_answer.toLowerCase().trim();
    const userAnswerProcessed = userAnswer.toLowerCase().trim();
    
    const isCorrect = userAnswerProcessed.includes(correctAnswer) || 
                     correctAnswer.includes(userAnswerProcessed);
    
    if (isCorrect) {
        score++;
        scoreCounter.textContent = `Score: ${score}`;
    }
    
    // Display the correct answer
    const answerFeedback = document.createElement('div');
    answerFeedback.classList.add('answer-feedback');
    answerFeedback.innerHTML = `
        <p class="${isCorrect ? 'correct' : 'incorrect'}">
            ${isCorrect ? '✓ Correct!' : '✗ Incorrect!'} 
        </p>
        <p>Expected answer: ${currentQuestion.correct_answer}</p>
    `;
    answerButtonsElement.appendChild(answerFeedback);
    
    // Disable textarea and submit button
    const textArea = document.querySelector('.open-ended-input');
    const submitButton = document.querySelector('.submit-answer');
    if (textArea) textArea.disabled = true;
    if (submitButton) submitButton.disabled = true;
    
    if (questions.length > currentQuestionIndex + 1) {
        nextBtn.classList.remove('hidden');
    } else {
        setTimeout(showFinalScore, 1500); 
    }
}

function copyQuiz() {
    if (!quizData) return;
    
    const quizText = `
Quiz Topic: ${quizSettings.topic || 'Custom uploaded content'}
Difficulty: ${quizSettings.difficulty}
Language: ${quizSettings.language}
Questions:
${questions.map((q, i) => `
${i+1}. ${q.question}
${q.type !== 'open-ended' ? 
    q.answers.map(a => `   - ${a} ${a === q.correct_answer ? '(Correct)' : ''}`).join('\n') : 
    `   Answer: ${q.correct_answer}`}
`).join('\n')}
    `.trim();
    
    navigator.clipboard.writeText(quizText)
        .then(() => {
            alert('Quiz copied to clipboard!');
        })
        .catch(err => {
            console.error('Failed to copy: ', err);
            alert('Failed to copy quiz to clipboard');
        });
}

function shareQuiz() {
    if (!quizData) return;
    
    if (navigator.share) {
        navigator.share({
            title: `Quiz about ${quizSettings.topic || 'Custom Content'}`,
            text: `Check out this quiz I created about ${quizSettings.topic || 'custom content'} with AI Quiz Generator!`,
        })
        .catch(err => {
            console.error('Error sharing: ', err);
        });
    } else {
        copyQuiz();
    }
}
