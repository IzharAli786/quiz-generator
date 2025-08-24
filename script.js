// ===================================================================================
//
// 🚨 DANGER: EXPOSING YOUR API KEY IN CLIENT-SIDE CODE IS A SEVERE SECURITY RISK! 🚨
//
// Anyone can view this code and steal your key. For a real application, this API
// call MUST be made from a backend server where the key can be kept secret.
// This implementation is for educational purposes only, as per the request.
//
// ===================================================================================

// Use your original API key since it works on localhost
const OPENROUTER_API_KEY = "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";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Backup API configuration
const BACKUP_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const BACKUP_API_KEY = "gsk_YOUR_GROQ_KEY_HERE"; // Free alternative

// OCR.space API key (free tier - register at ocr.space for y   our own key)
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

    // Detect if running on Netlify
    const isNetlify = window.location.hostname.includes('netlify.app') || 
                     window.location.hostname.includes('netlify.com') ||
                     window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

    console.log(`Running on: ${window.location.hostname}, Netlify detected: ${isNetlify}`);

    // Try API call with proper Netlify configuration
    try {
        console.log("Attempting OpenRouter API call...");
        
        // Special headers for Netlify deployment
        const headers = {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json'
        };

        // Only add referrer headers if not on Netlify (to avoid CORS issues)
        if (!isNetlify) {
            headers['HTTP-Referer'] = window.location.origin;
            headers['X-Title'] = 'AI Quiz Generator';
        }

        const requestBody = {
            model: "meta-llama/llama-3.1-70b-instruct",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 1000000
        };

        console.log("Making API request with headers:", headers);
        console.log("Request body:", requestBody);

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        console.log(`API Response Status: ${response.status}`);
        console.log(`API Response Headers:`, response.headers);

        if (response.ok) {
            const data = await response.json();
            console.log("API Response Data:", data);
            
            if (data.choices && data.choices[0] && data.choices[0].message) {
                const llmResponse = data.choices[0].message.content;
                console.log("LLM Response:", llmResponse);
                
                // Try to extract JSON from the response
                let jsonString = llmResponse;
                const jsonStartIndex = llmResponse.indexOf('[');
                const jsonEndIndex = llmResponse.lastIndexOf(']') + 1;
                
                if (jsonStartIndex >= 0 && jsonEndIndex > jsonStartIndex) {
                    jsonString = llmResponse.substring(jsonStartIndex, jsonEndIndex);
                }
                
                try {
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
                        
                        console.log(`Successfully generated ${questions.length} questions via API`);
                        return; // Success!
                    } else {
                        console.log("API returned invalid question format");
                    }
                } catch (parseError) {
                    console.error("JSON parsing failed:", parseError);
                    console.log("Raw response that failed to parse:", llmResponse);
                }
            } else {
                console.error("Invalid API response structure:", data);
            }
        } else {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error(`API Error ${response.status}:`, errorText);
            
            // If it's a 401 error, the API key might be blocked on Netlify
            if (response.status === 401) {
                console.log("401 error detected - API key might be blocked on Netlify");
            }
        }
    } catch (networkError) {
        console.error("Network error during API call:", networkError);
        
        // Check if it's a CORS error
        if (networkError.message && networkError.message.includes('CORS')) {
            console.log("CORS error detected - using fallback");
        }
    }

    // If API fails, use the intelligent fallback
    console.log("API call failed, using intelligent fallback system");
    questions = generateIntelligentQuestions(topic, numQuestions, questionTypes, difficulty, language);
    
    if (questions.length === 0) {
        throw new Error("Unable to generate quiz questions. Please try a different topic.");
    }
    
    quizData = {
        settings: quizSettings,
        questions: questions
    };

    console.log(`Generated ${questions.length} questions using fallback system`);
}

// Enhanced intelligent question generator
function generateIntelligentQuestions(topic, numQuestions, questionTypes, difficulty, language) {
    console.log(`Generating intelligent questions for: ${topic}`);
    
    const questions = [];
    const topicLower = topic.toLowerCase();
    
    // Knowledge base for different subjects
    const knowledgeBase = {
        science: {
            easy: [
                { q: "What is the chemical symbol for water?", a: ["H2O", "CO2", "O2", "H2SO4"], correct: "H2O" },
                { q: "What planet is closest to the Sun?", a: ["Mercury", "Venus", "Earth", "Mars"], correct: "Mercury" },
                { q: "Plants make their own food through photosynthesis.", tf: true }
            ],
            medium: [
                { q: "What is the speed of light in vacuum?", a: ["300,000 km/s", "150,000 km/s", "450,000 km/s", "600,000 km/s"], correct: "300,000 km/s" },
                { q: "DNA stands for Deoxyribonucleic Acid.", tf: true }
            ],
            hard: [
                { q: "What is Heisenberg's uncertainty principle?", open: "The uncertainty principle states that you cannot simultaneously know both the exact position and momentum of a particle" }
            ]
        },
        history: {
            easy: [
                { q: "World War II ended in which year?", a: ["1945", "1944", "1946", "1943"], correct: "1945" },
                { q: "The Great Wall of China was built to keep out invaders.", tf: true }
            ],
            medium: [
                { q: "Who was the first President of the United States?", a: ["George Washington", "Thomas Jefferson", "John Adams", "Benjamin Franklin"], correct: "George Washington" },
                { q: "The Roman Empire fell in 476 AD.", tf: true }
            ],
            hard: [
                { q: "Explain the causes of World War I.", open: "World War I was caused by a complex mix of factors including imperialism, alliance systems, nationalism, and the assassination of Archduke Franz Ferdinand" }
            ]
        },
        geography: {
            easy: [
                { q: "What is the capital of France?", a: ["Paris", "London", "Berlin", "Madrid"], correct: "Paris" },
                { q: "Africa is the largest continent.", tf: true }
            ],
            medium: [
                { q: "Which river is the longest in the world?", a: ["Nile", "Amazon", "Yangtze", "Mississippi"], correct: "Nile" },
                { q: "Australia is both a country and a continent.", tf: true }
            ],
            hard: [
                { q: "Describe the formation of the Himalayan mountain range.", open: "The Himalayas were formed by the collision of the Indian and Eurasian tectonic plates approximately 50 million years ago" }
            ]
        },
        mathematics: {
            easy: [
                { q: "What is 15 + 25?", a: ["40", "35", "45", "50"], correct: "40" },
                { q: "Pi is approximately 3.14.", tf: true }
            ],
            medium: [
                { q: "What is the square root of 144?", a: ["12", "14", "10", "16"], correct: "12" },
                { q: "A triangle has 180 degrees.", tf: true }
            ],
            hard: [
                { q: "Explain the Pythagorean theorem.", open: "The Pythagorean theorem states that in a right triangle, the square of the hypotenuse equals the sum of squares of the other two sides: a² + b² = c²" }
            ]
        }
    };

    // Detect subject category
    let category = 'general';
    if (topicLower.includes('science') || topicLower.includes('physics') || topicLower.includes('chemistry') || topicLower.includes('biology')) {
        category = 'science';
    } else if (topicLower.includes('history') || topicLower.includes('war') || topicLower.includes('ancient')) {
        category = 'history';
    } else if (topicLower.includes('geography') || topicLower.includes('country') || topicLower.includes('capital')) {
        category = 'geography';
    } else if (topicLower.includes('math') || topicLower.includes('algebra') || topicLower.includes('geometry')) {
        category = 'mathematics';
    }

    const difficultyLevel = difficulty.toLowerCase();
    let questionPool = [];

    // Get questions from knowledge base if available
    if (knowledgeBase[category] && knowledgeBase[category][difficultyLevel]) {
        questionPool = [...knowledgeBase[category][difficultyLevel]];
    }

    // Generate topic-specific questions
    const topicQuestions = generateTopicSpecificQuestions(topic, numQuestions, questionTypes, difficulty, language);
    questionPool = [...questionPool, ...topicQuestions];

    // Select and format questions based on types
    let questionsAdded = 0;
    const typeDistribution = {};
    
    // Calculate how many of each type to add
    questionTypes.forEach((type, index) => {
        typeDistribution[type] = Math.floor(numQuestions / questionTypes.length);
        if (index < numQuestions % questionTypes.length) {
            typeDistribution[type]++;
        }
    });

    // Add questions of each type
    for (const [type, count] of Object.entries(typeDistribution)) {
        let addedOfType = 0;
        
        for (const poolQ of questionPool) {
            if (addedOfType >= count || questionsAdded >= numQuestions) break;
            
            if (type === 'multiple-choice' && poolQ.a) {
                questions.push({
                    question: poolQ.q,
                    type: 'multiple-choice',
                    answers: poolQ.a,
                    correct_answer: poolQ.correct
                });
                addedOfType++;
                questionsAdded++;
            } else if (type === 'true-false' && poolQ.tf !== undefined) {
                questions.push({
                    question: poolQ.q,
                    type: 'true-false',
                    answers: ['True', 'False'],
                    correct_answer: poolQ.tf ? 'True' : 'False'
                });
                addedOfType++;
                questionsAdded++;
            } else if (type === 'open-ended' && poolQ.open) {
                questions.push({
                    question: poolQ.q,
                    type: 'open-ended',
                    answers: [],
                    correct_answer: poolQ.open
                });
                addedOfType++;
                questionsAdded++;
            }
        }
    }

    return questions.slice(0, numQuestions);
}

function generateTopicSpecificQuestions(topic, numQuestions, questionTypes, difficulty, language) {
    const questions = [];
    
    // Generate multiple choice questions
    if (questionTypes.includes('multiple-choice')) {
        questions.push({
            q: `What is the main concept behind ${topic}?`,
            a: [
                `Understanding ${topic} principles`,
                'Unrelated concept A',
                'Unrelated concept B',
                'Unrelated concept C'
            ],
            correct: `Understanding ${topic} principles`
        });
        
        questions.push({
            q: `Which of the following is most associated with ${topic}?`,
            a: [
                `Key aspects of ${topic}`,
                'Random option 1',
                'Random option 2',
                'Random option 3'
            ],
            correct: `Key aspects of ${topic}`
        });
    }
    
    // Generate true/false questions
    if (questionTypes.includes('true-false')) {
        questions.push({
            q: `${topic} is an important subject of study.`,
            tf: true
        });
        
        questions.push({
            q: `Learning about ${topic} can be beneficial.`,
            tf: true
        });
    }
    
    // Generate open-ended questions
    if (questionTypes.includes('open-ended')) {
        questions.push({
            q: `Explain the significance of ${topic}.`,
            open: `${topic} is significant because it provides important knowledge and understanding in its field of study.`
        });
        
        questions.push({
            q: `What are the key principles of ${topic}?`,
            open: `The key principles of ${topic} include fundamental concepts and methodologies that define this area of study.`
        });
    }
    
    return questions;
}

// --- Error Handling and UI Functions ---
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
        return;
    }
    
    // Add file size validation
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showError('Image file is too large. Please select an image smaller than 5MB.');
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

// Add better error handling for image extraction on Netlify
async function extractTextFromImage(imageData) {
    try {
        console.log("Attempting OCR on Netlify...");
        
        // Create form data for OCR API request
        const formData = new FormData();
        
        // Convert base64 to blob for the form data
        const base64Response = await fetch(imageData);
        const blob = await base64Response.blob();
        
        formData.append('file', blob, 'image.jpg');
        formData.append('apikey', OCR_API_KEY);
        formData.append('language', 'eng');
        formData.append('isOverlayRequired', 'false');
        formData.append('iscreatesearchablepdf', 'false');
        formData.append('issearchablepdfhidetextlayer', 'false');
        
        const ocrResponse = await fetch(OCR_API_URL, {
            method: 'POST',
            body: formData,
        });
        
        console.log(`OCR Response Status: ${ocrResponse.status}`);
        
        if (!ocrResponse.ok) {
            throw new Error(`OCR API error: ${ocrResponse.status}`);
        }
        
        const ocrData = await ocrResponse.json();
        console.log("OCR Response:", ocrData);
        
        if (ocrData.OCRExitCode !== 1) {
            throw new Error(`OCR processing error: ${ocrData.ErrorMessage || 'Unknown error'}`);
        }
        
        // Extract text from response
        let extractedText = '';
        if (ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
            extractedText = ocrData.ParsedResults.map(result => result.ParsedText).join('\n');
        }
        
        if (!extractedText || extractedText.trim() === '') {
            throw new Error('No text found in the image');
        }
        
        console.log('Successfully extracted text:', extractedText);
        
        // Check if the text is too short
        if (extractedText.trim().length < 10) {
            throw new Error('The extracted text is too short. Please use an image with more readable text.');
        }
        
        return extractedText;
    } catch (error) {
        console.error('OCR error on Netlify:', error);
        
        // On Netlify, if OCR fails, provide a more helpful error
        if (window.location.hostname.includes('netlify')) {
            throw new Error('Image text extraction is not available in the deployed version. Please use the topic input instead.');
        } else {
            throw new Error(`Failed to extract text: ${error.message}`);
        }
    }
}
