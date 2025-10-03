import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

// --- MOCK DATA and TYPES --- //
type View = "senior" | "caregiver";
type Message = { sender: "user" | "ai"; text: string; id: number };
type GameState = "not_started" | "playing" | "completed";
type GameScore = { score: number; attempts: number; time: number; date: Date };
type Sentiment = "Positive" | "Neutral" | "Negative";
type RiskLevel = "Low" | "Medium" | "High";
type ConversationStage = "greeting" | "memory_probe" | "social_probe" | "recommendation" | "free_chat";
type RiskFactor = "Low" | "Medium" | "High" | "Unknown";
type ScreeningResult = { memory: RiskFactor, social: RiskFactor };

const MOCK_GAME_HISTORY: GameScore[] = [
  { score: 85, attempts: 10, time: 60, date: new Date(Date.now() - 86400000 * 3) },
  { score: 88, attempts: 9, time: 55, date: new Date(Date.now() - 86400000 * 2) },
  { score: 92, attempts: 8, time: 50, date: new Date(Date.now() - 86400000 * 1) },
];
const MOCK_ENGAGEMENT = { "Mon": 5, "Tue": 8, "Wed": 6, "Thu": 9 };
const MOCK_SENTIMENT_DATA = { "Positive": 12, "Neutral": 5, "Negative": 2 };

// --- API SETUP --- //
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- HELPER COMPONENTS --- //
const PieChart = ({ data }: { data: { [key: string]: number } }) => {
  const colors = { Positive: "#4caf50", Neutral: "#ffc107", Negative: "#f44336" };
  const total = Object.values(data).reduce((sum, value) => sum + value, 0);
  if (total === 0) return <p>No sentiment data yet.</p>;
  let cumulativePercent = 0;
  const segments = Object.entries(data).map(([key, value]) => {
    const percent = (value / total) * 100;
    const startAngle = (cumulativePercent / 100) * 360;
    cumulativePercent += percent;
    return `${colors[key]} ${startAngle}deg ${startAngle + (percent / 100) * 360}deg`;
  });

  return (
    <div>
        <div className="pie-chart" style={{ background: `conic-gradient(${segments.join(', ')})` }}></div>
         <div className="pie-legend">
            {Object.keys(data).map(key => (
                <div key={key} className="legend-item">
                    <div className="legend-color" style={{ backgroundColor: colors[key] }}></div>
                    <span>{key}</span>
                </div>
            ))}
        </div>
    </div>
  );
};

const BarChart = ({ data }: { data: { [key: string]: number } }) => {
    const maxValue = Math.max(...Object.values(data), 1);
    return (
        <div className="bar-chart">
            {Object.entries(data).map(([key, value]) => (
                <div key={key} className="bar" style={{ height: `${(value / maxValue) * 100}%` }} title={`${key}: ${value} messages`}>
                    <div className="bar-label">{key}</div>
                </div>
            ))}
        </div>
    );
};

const LineChart = ({ data }: { data: GameScore[] }) => {
    if (data.length < 2) return <p>Not enough data to draw a line chart.</p>;
    const maxValue = Math.max(...data.map(d => d.score), 100);
    const points = data.map((d, i) => `${(i / (data.length - 1)) * 100},${100 - (d.score / maxValue) * 100}`).join(' ');

    return (
        <div className="line-chart">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline fill="none" stroke="#00796b" strokeWidth="2" points={points} />
            </svg>
        </div>
    );
};


// --- GAME COMPONENT --- //
const WordMatchingGame = ({ onGameComplete, onExit }) => {
  const words = ['Cat', 'Sun', 'Cup', 'Ball', 'Tree', 'Star', 'Cat', 'Sun', 'Cup', 'Ball', 'Tree', 'Star'];
  const [shuffledWords, setShuffledWords] = useState<string[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<string[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [startTime, setStartTime] = useState(Date.now());

  useEffect(() => {
    setShuffledWords(words.sort(() => 0.5 - Math.random()));
    setStartTime(Date.now());
  }, []);

  const handleCardClick = (index: number) => {
    if (flippedIndices.length === 2 || flippedIndices.includes(index) || matchedPairs.includes(shuffledWords[index])) {
      return;
    }

    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 2) {
      setAttempts(attempts + 1);
      const [firstIndex, secondIndex] = newFlipped;
      if (shuffledWords[firstIndex] === shuffledWords[secondIndex]) {
        setTimeout(() => {
          setMatchedPairs([...matchedPairs, shuffledWords[firstIndex]]);
          setFlippedIndices([]);
        }, 500);
      } else {
        setTimeout(() => setFlippedIndices([]), 1000);
      }
    }
  };

  useEffect(() => {
    if (matchedPairs.length === words.length / 2) {
      const time = Math.floor((Date.now() - startTime) / 1000);
      const score = Math.max(0, 100 - (attempts - words.length / 2) * 5 - Math.floor(time / 10));
      onGameComplete({ score, attempts, time, date: new Date() });
    }
  }, [matchedPairs]);

  return (
    <div className="game-container">
      <h2>Word Matching Game</h2>
      <p className="game-info">Attempts: {attempts}</p>
      <div className="game-board">
        {shuffledWords.map((word, index) => (
          <div
            key={index}
            className={`game-card ${flippedIndices.includes(index) ? 'flipped' : ''} ${matchedPairs.includes(word) ? 'matched' : ''}`}
            onClick={() => handleCardClick(index)}
          >
            <div className="card-content">{word}</div>
          </div>
        ))}
      </div>
      <button onClick={onExit} className="back-to-chat-btn">Back to Chat</button>
    </div>
  );
};


// --- VIEWS --- //
const SeniorView = ({ setGameHistory, setSentimentData, setScreeningResult }) => {
  const [messages, setMessages] = useState<Message[]>([
    { sender: 'ai', text: "Good morning! I'm Elara, your personal companion. How are you feeling today?", id: 0 },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [gameState, setGameState] = useState<GameState>("not_started");
  const [conversationStage, setConversationStage] = useState<ConversationStage>("greeting");
  const chatWindowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatWindowRef.current?.scrollTo(0, chatWindowRef.current.scrollHeight);
  }, [messages]);

  const analyzeResponseType = async (text: string, type: 'memory' | 'social'): Promise<RiskFactor> => {
      let prompt = "";
      if (type === 'memory') {
          prompt = `A senior was asked what they had for breakfast to check their short-term memory. Their response was: "${text}". Analyze this for memory gaps. Respond with only one word: 'Low' for a clear response, 'Medium' for a vague or hesitant response, or 'High' for a response indicating they don't remember (e.g., "I don't know").`;
      } else { // social
          prompt = `A senior was asked if they have spoken with friends or family this week. Their response was: "${text}". Analyze this for social isolation risk. Respond with only one word: 'Low' for a positive social connection, 'Medium' for an ambiguous response, or 'High' for a response indicating loneliness or lack of contact.`;
      }

      try {
        const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
        const result = response.text.trim();
        if (["Low", "Medium", "High"].includes(result)) {
            return result as RiskFactor;
        }
      } catch (error) {
        console.error(`AI analysis failed for ${type}:`, error);
      }
      return "Unknown";
  };
  
  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { sender: 'user', text: input, id: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setIsLoading(true);

    // General Sentiment Analysis
    try {
        const sentimentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Analyze the sentiment of this text: "${currentInput}". Respond with only one word: Positive, Neutral, or Negative.`
        });
        const sentiment = sentimentResponse.text.trim() as Sentiment;
        if (["Positive", "Neutral", "Negative"].includes(sentiment)) {
            setSentimentData(prev => ({...prev, [sentiment]: (prev[sentiment] || 0) + 1}));
        }
    } catch (error) {
        console.error("Sentiment analysis failed:", error);
    }
    
    // Structured Conversation Flow
    let aiResponseText = "";
    try {
        if (conversationStage === 'greeting') {
            aiResponseText = "I'm glad to hear that. To help keep our minds sharp, would you mind telling me what you had for breakfast this morning?";
            setConversationStage('memory_probe');
        } else if (conversationStage === 'memory_probe') {
            const memoryRisk = await analyzeResponseType(currentInput, 'memory');
            setScreeningResult(prev => ({...prev, memory: memoryRisk}));
            aiResponseText = "Thank you for sharing. Staying connected with loved ones is important too. Have you had a chance to speak with any friends or family this week?";
            setConversationStage('social_probe');
        } else if (conversationStage === 'social_probe') {
            const socialRisk = await analyzeResponseType(currentInput, 'social');
            setScreeningResult(prev => ({...prev, social: socialRisk}));
            aiResponseText = "I appreciate you talking with me. Keeping our minds and social lives active is so beneficial. How about a fun Word Matching game to get the day started?";
            setConversationStage('recommendation');
        } else { // recommendation or free_chat
             const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `You are Elara, a friendly AI companion for seniors. You are supportive and encouraging. A senior just said: "${currentInput}". Keep your response concise, friendly, and use simple language. If they ask for a game, offer 'Word Matching' or 'Daily Trivia'.`
            });
            aiResponseText = response.text;
            setConversationStage('free_chat');
        }
    } catch(error) {
        console.error("Error fetching AI response:", error);
        aiResponseText = "I'm having a little trouble connecting right now. Let's try again in a moment.";
    }

    const aiMessage: Message = { sender: 'ai', text: aiResponseText, id: Date.now() + 1 };
    setMessages(prev => [...prev, aiMessage]);
    setIsLoading(false);
  };
  
  const handleGameComplete = (scoreData: GameScore) => {
    setGameHistory(prev => [...prev, scoreData]);
    setGameState("completed");
  };

  if (gameState === "playing") {
    return <WordMatchingGame onGameComplete={handleGameComplete} onExit={() => setGameState("not_started")} />;
  }
  
  if (gameState === "completed") {
    const lastGame = MOCK_GAME_HISTORY[MOCK_GAME_HISTORY.length-1];
    return (
        <div className="game-completed">
            <h2>Great job!</h2>
            <p>You completed the game with a score of {lastGame.score} in {lastGame.attempts} attempts.</p>
            <button onClick={() => setGameState("not_started")} className="back-to-chat-btn">Back to Chat</button>
        </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-window" ref={chatWindowRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message ${msg.sender}`}>
            <div className="sender">{msg.sender === 'ai' ? 'Elara' : 'You'}</div>
            <div className="text">{msg.text}</div>
             {msg.sender === 'ai' && msg.text.toLowerCase().includes("word matching") && (
                <div className="game-prompt">
                    <button onClick={() => setGameState('playing')}>Play Word Matching</button>
                </div>
            )}
          </div>
        ))}
        {isLoading && <div className="chat-message ai"><div className="text">...</div></div>}
      </div>
      <form className="chat-input-form" onSubmit={sendMessage}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          aria-label="Chat input"
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>Send</button>
      </form>
    </div>
  );
};


const CaregiverView = ({ gameHistory, sentimentData, screeningResult }: { gameHistory: GameScore[], sentimentData: Record<Sentiment, number>, screeningResult: ScreeningResult }) => {
    const [riskScore, setRiskScore] = useState<number>(75);
    const [riskLevel, setRiskLevel] = useState<RiskLevel>("Low");
    const [notification, setNotification] = useState<{ message: string; level: RiskLevel } | null>(null);

    useEffect(() => {
        // More sophisticated risk calculation
        const latestGameScore = gameHistory.length > 0 ? gameHistory[gameHistory.length - 1].score : 75;
        
        const totalSentiments = Object.values(sentimentData).reduce((a, b) => a + b, 0);
        const positiveRatio = totalSentiments > 0 ? (sentimentData.Positive / totalSentiments) : 0.7;

        let screeningScore = 100;
        if (screeningResult.memory === 'Medium') screeningScore -= 25;
        if (screeningResult.memory === 'High') screeningScore -= 50;
        if (screeningResult.social === 'Medium') screeningScore -= 15;
        if (screeningResult.social === 'High') screeningScore -= 30;

        const calculatedScore = Math.round(
            (latestGameScore * 0.4) + 
            (positiveRatio * 100 * 0.3) +
            (screeningScore * 0.3)
        );
        setRiskScore(calculatedScore);

        let newLevel: RiskLevel;
        if (calculatedScore >= 70) newLevel = "Low";
        else if (calculatedScore >= 40) newLevel = "Medium";
        else newLevel = "High";

        if (newLevel !== riskLevel) {
            setNotification({ message: `Risk level changed to ${newLevel}`, level: newLevel });
            setTimeout(() => setNotification(null), 4000);
        }
        setRiskLevel(newLevel);

    }, [gameHistory, sentimentData, screeningResult]);

    const riskColorClass = (risk: RiskFactor | RiskLevel) => risk.toLowerCase();

    return (
        <div>
             {notification && (
                <div className={`notification ${riskColorClass(notification.level)} show`}>
                    {notification.message}
                </div>
            )}
            <div className="dashboard-grid">
                <div className="dashboard-card risk-score-display">
                    <h3>Overall Cognitive Risk</h3>
                    <div className={`risk-score-value ${riskColorClass(riskLevel)}`}>{riskLevel}</div>
                    <div className="risk-score-label">(Score: {riskScore})</div>
                </div>
                <div className="dashboard-card">
                    <h3>Daily Check-in</h3>
                    <div className="metric">
                        <span>Short-term Memory</span>
                        <strong className={`risk-text-${riskColorClass(screeningResult.memory)}`}>{screeningResult.memory}</strong>
                    </div>
                     <div className="metric">
                        <span>Social Connection</span>
                        <strong className={`risk-text-${riskColorClass(screeningResult.social)}`}>{screeningResult.social}</strong>
                    </div>
                </div>
                 <div className="dashboard-card">
                    <h3>Engagement (Messages/Day)</h3>
                    <BarChart data={MOCK_ENGAGEMENT} />
                </div>
                <div className="dashboard-card">
                    <h3>Memory Game Performance</h3>
                    <LineChart data={gameHistory} />
                </div>
                <div className="dashboard-card">
                    <h3>Sentiment Trend</h3>
                    <PieChart data={sentimentData} />
                </div>
                 <div className="dashboard-card">
                    <h3>Key Metrics</h3>
                     <div className="metric">
                        <span>Avg. Game Score</span>
                        <strong>{gameHistory.length > 0 ? Math.round(gameHistory.reduce((a, b) => a + b.score, 0) / gameHistory.length) : 'N/A'}</strong>
                    </div>
                     <div className="metric">
                        <span>Positive Sentiment</span>
                        <strong>
                            {(() => {
                                const total = Object.values(sentimentData).reduce((a, b) => a + b, 0);
                                return total > 0 ? `${Math.round((sentimentData.Positive / total) * 100)}%` : 'N/A';
                            })()}
                        </strong>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MAIN APP COMPONENT --- //
const App = () => {
  const [view, setView] = useState<View>("senior");
  const [gameHistory, setGameHistory] = useState<GameScore[]>(MOCK_GAME_HISTORY);
  const [sentimentData, setSentimentData] = useState(MOCK_SENTIMENT_DATA);
  const [screeningResult, setScreeningResult] = useState<ScreeningResult>({ memory: 'Unknown', social: 'Unknown' });


  return (
    <>
      <header className="app-header">
        <h1>AI Companion</h1>
        <div className="view-toggle" role="tablist">
          <button
            onClick={() => setView("senior")}
            className={view === "senior" ? "active" : ""}
            role="tab"
            aria-selected={view === 'senior'}
          >
            Senior View
          </button>
          <button
            onClick={() => setView("caregiver")}
            className={view === "caregiver" ? "active" : ""}
            role="tab"
            aria-selected={view === 'caregiver'}
          >
            Caregiver Dashboard
          </button>
        </div>
      </header>
      <main className="main-content">
        {view === "senior" ? (
          <SeniorView setGameHistory={setGameHistory} setSentimentData={setSentimentData} setScreeningResult={setScreeningResult} />
        ) : (
          <CaregiverView gameHistory={gameHistory} sentimentData={sentimentData} screeningResult={screeningResult} />
        )}
      </main>
    </>
  );
};

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(<App />);