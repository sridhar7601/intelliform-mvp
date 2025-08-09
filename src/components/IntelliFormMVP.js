import React, { useState, useEffect } from 'react';
import { MessageCircle, Bot, User, FileText, Download, Settings, Zap, Database, CheckCircle, Server, Clock, Users, File, Eye, Trash2, Shield, Verified } from 'lucide-react';

const LangChainIntelliForm = () => {
  const [messages, setMessages] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionState, setSessionState] = useState('INIT');
  const [formContext, setFormContext] = useState(null);
  const [collectedData, setCollectedData] = useState({});
  const [systemLogs, setSystemLogs] = useState([]);
  const [backendConnected, setBackendConnected] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [generatedFiles, setGeneratedFiles] = useState([]);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [verifiedForms, setVerifiedForms] = useState([]);

  // 🔥 NEW: LangChain-specific state
  const [isVerifiedForm, setIsVerifiedForm] = useState(false);
  const [confidence, setConfidence] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [conversationMemory, setConversationMemory] = useState('');

  const states = {
    'INIT': 'Ready to help',
    'FORM_DISCOVERY': 'Finding your form',
    'COLLECTING': 'Collecting information',
    'COMPLETE': 'Form completed',
    'REVIEW': 'Reviewing details'
  };

  // 🌐 Enhanced Backend API for LangChain
  const callLangChainAPI = async (prompt, includeSessionId = true) => {
    try {
      addSystemLog(`🦜 LangChain API Call`, `Session: ${sessionId || 'new'}, Message: "${prompt.substring(0, 50)}..."`);
      
      const requestBody = {
        message: prompt
      };
      
      if (includeSessionId && sessionId) {
        requestBody.sessionId = sessionId;
      }
      
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'LangChain API error');
      }

      // 🔥 NEW: Update LangChain-specific state
      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
        addSystemLog(`🆔 Session Created`, `LangChain session: ${data.sessionId}`);
      }
      
      if (data.sessionState) {
        setSessionInfo(data.sessionState);
        setSessionState(data.sessionState.state);
        setIsVerifiedForm(data.sessionState.verified || false);
        
        if (data.sessionState.currentForm) {
          setFormContext({
            type: data.sessionState.currentForm,
            details: data.response.formDetails,
            verified: data.sessionState.verified,
            isLangChain: true
          });
        }
      }

      // Track confidence levels
      if (data.response.confidence !== undefined) {
        setConfidence(data.response.confidence);
      }

      addSystemLog(`✅ LangChain Response`, `Intent: ${data.response.intent}, Verified: ${data.sessionState?.verified || false}`);
      
      return data;

    } catch (error) {
      addSystemLog(`❌ LangChain Error`, error.message);
      setBackendConnected(false);
      
      return {
        success: false,
        response: {
          intent: 'error',
          message: "I'm having trouble connecting to the LangChain backend. Please try again.",
          confidence: 0.1
        }
      };
    }
  };

  // 📄 Generate PDF with verified data
  const generateVerifiedPDF = async () => {
    if (!sessionId || sessionState !== 'COMPLETE') {
      addSystemLog(`❌ PDF Error`, 'Session not ready for PDF generation');
      return;
    }

    setIsGeneratingPDF(true);
    addSystemLog(`📄 Verified PDF Generation`, `Starting PDF generation for verified form: ${formContext?.type}`);

    try {
      const response = await fetch('http://localhost:3001/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'PDF generation failed');
      }

      const data = await response.json();
      
      if (data.success) {
        addSystemLog(`✅ Verified PDF Generated`, `File: ${data.filename}`);
        
        setGeneratedFiles(prev => [...prev, {
          filename: data.filename,
          downloadUrl: `http://localhost:3001${data.downloadUrl}`,
          formType: formContext?.type,
          formName: data.formName,
          generatedAt: new Date().toISOString(),
          verified: data.verified
        }]);

        addMessage('bot', `📄 **✅ Verified Government PDF Generated!**

Your ${data.formName} application has been generated using **VERIFIED government data** and requirements.

**File Details:**
• **Filename:** ${data.filename}
• **Form Type:** ${data.formName}
• **Data Source:** ✅ Verified Government Requirements
• **Generated:** ${new Date().toLocaleString()}

🛡️ **This PDF is generated from our verified government forms database, ensuring accuracy and compliance with official requirements.**

You can download or preview your form using the buttons below.`, {
          pdfGenerated: true,
          filename: data.filename,
          downloadUrl: data.downloadUrl,
          verified: true
        });

      } else {
        throw new Error('PDF generation failed');
      }

    } catch (error) {
      addSystemLog(`❌ PDF Error`, error.message);
      addMessage('bot', `Sorry, I encountered an error generating the PDF: ${error.message}`);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Check LangChain backend health
  const checkLangChainHealth = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/health');
      if (response.ok) {
        const data = await response.json();
        setBackendConnected(true);
        setVerifiedForms(data.verified_forms || []);
        addSystemLog(`✅ LangChain Health`, `V4.0 running, ${data.sessions} sessions, ${data.verified_forms?.length} verified forms`);
        return true;
      }
    } catch (error) {
      setBackendConnected(false);
      addSystemLog(`❌ LangChain Health`, 'LangChain server not reachable');
      return false;
    }
  };

  const addSystemLog = (action, details) => {
    const log = {
      timestamp: new Date().toLocaleTimeString(),
      action,
      details
    };
    setSystemLogs(prev => [log, ...prev.slice(0, 9)]);
  };

  const addMessage = (type, content, metadata = {}) => {
    const message = {
      id: Date.now(),
      type,
      content,
      timestamp: new Date(),
      metadata
    };
    setMessages(prev => [...prev, message]);
  };

  // 🔥 Enhanced message processing for LangChain responses
  const processUserInput = async () => {
    if (!currentInput.trim()) return;
    
    const userMessage = currentInput.trim();
    setCurrentInput('');
    setIsProcessing(true);
    setValidationErrors([]);
    
    addMessage('user', userMessage);
    addSystemLog(`👤 User Input`, userMessage);
    
    try {
      const result = await callLangChainAPI(userMessage);
      
      if (!result.success) {
        addMessage('bot', result.response.message);
        setIsProcessing(false);
        return;
      }
      
      const { response } = result;
      
      addSystemLog(`🧠 LangChain Response`, `Intent: ${response.intent}, Confidence: ${response.confidence || 'N/A'}`);
      
      // Process different LangChain response types
      processLangChainResponse(response);
      
    } catch (error) {
      addSystemLog(`❌ Error`, error.message);
      addMessage('bot', 'I encountered an error processing your request. Please try again.');
    }
    
    setIsProcessing(false);
  };

  // 🔥 NEW: Process LangChain-specific responses
  const processLangChainResponse = (response) => {
    switch (response.intent) {
      case 'form_discovered':
        addSystemLog(`📋 Verified Form Discovered`, `${response.formDetails.name}`);
        setCollectedData({});
        
        addMessage('bot', response.message, {
          formDiscovered: true,
          formDetails: response.formDetails,
          verified: true,
          confidence: response.confidence
        });
        break;

      case 'next_question':
        addSystemLog(`❓ Next Question`, `Progress: ${response.progress}`);
        
        addMessage('bot', response.message, {
          nextQuestion: true,
          progress: response.progress,
          verified: isVerifiedForm
        });
        break;

      case 'form_complete':
        addSystemLog(`✅ Verified Form Complete`, `All fields validated`);
        setCollectedData(response.formData);
        
        setTimeout(() => {
          addMessage('bot', `${response.message}

**✅ All information has been validated using verified government requirements.**

**Next Steps:**
1. **Generate Verified PDF** - Click the button below to create a government-compliant form
2. **All data validated** - Your information meets official requirements  
3. **Ready for submission** - PDF will be formatted according to government standards

Would you like me to generate the verified PDF now?`, {
            formComplete: true,
            canGeneratePDF: true,
            verified: true,
            formDetails: response.formDetails
          });
        }, 1000);
        break;

      case 'validation_error':
        addSystemLog(`⚠️ Validation Error`, response.message);
        setValidationErrors(prev => [...prev, response.message]);
        
        addMessage('bot', `⚠️ **Input Validation Issue**

${response.message}

${response.retryQuestion ? `Please try again:\n\n${response.retryQuestion}` : 'Please provide the correct information.'}`, {
          validationError: true,
          retryRequired: true
        });
        break;

      case 'clarification_needed':
        addSystemLog(`❓ Clarification Required`, response.message);
        
        addMessage('bot', `❓ **Need More Information**

${response.message}

**✅ I can help you with these VERIFIED government forms:**
${verifiedForms.map(form => `• ${form.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`).join('\n')}

These forms use verified government data to ensure accuracy and compliance.`, {
          clarificationNeeded: true,
          verifiedForms: verifiedForms
        });
        break;

      case 'error':
        addSystemLog(`❌ LangChain Error`, response.message);
        addMessage('bot', `❌ **System Error**

${response.message}

Please try rephrasing your request or contact support if the issue persists.`);
        break;

      default:
        addMessage('bot', response.message, {
          intent: response.intent,
          confidence: response.confidence
        });
    }
  };

  const resetSession = () => {
    setMessages([]);
    setSessionState('INIT');
    setFormContext(null);
    setCollectedData({});
    setSystemLogs([]);
    setSessionId(null);
    setSessionInfo(null);
    setGeneratedFiles([]);
    setIsVerifiedForm(false);
    setConfidence(null);
    setValidationErrors([]);
    
    addMessage('bot', `🦜 **Hello! I'm IntelliForm AI V4.0 powered by LangChain**

I use **VERIFIED government form data** to ensure accuracy and compliance. I can help you with:

**✅ Verified Government Forms:**
${verifiedForms.map(form => `• ${form.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`).join('\n')}

**🛡️ Key Features:**
• Verified government requirements
• Strict field validation  
• Conversation memory
• Professional PDF generation

What government form do you need help with today?`);
    
    addSystemLog(`🔄 Session Reset`, 'New LangChain conversation started');
  };

  const testLangChainConnection = async () => {
    addSystemLog(`🧪 Testing LangChain`, `Attempting V4.0 connection...`);
    const isConnected = await checkLangChainHealth();
    
    if (isConnected) {
      try {
        const testResponse = await callLangChainAPI("Test LangChain V4.0 connection", false);
        addSystemLog(`✅ Test Success`, `LangChain V4.0 with verified forms ready!`);
      } catch (error) {
        addSystemLog(`❌ Test Failed`, error.message);
      }
    }
  };

  // Download and preview functions (same as before)
  const downloadFile = (filename, downloadUrl) => {
    addSystemLog(`💾 Download`, `Downloading: ${filename}`);
    window.open(downloadUrl, '_blank');
  };

  const previewFile = (filename) => {
    addSystemLog(`👁️ Preview`, `Previewing: ${filename}`);
    const previewUrl = `http://localhost:3001/api/preview/${filename}`;
    window.open(previewUrl, '_blank');
  };

  useEffect(() => {
    checkLangChainHealth();
    resetSession();
    
    const healthCheckInterval = setInterval(checkLangChainHealth, 30000);
    
    return () => clearInterval(healthCheckInterval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 🔥 Enhanced Header with LangChain branding */}
      <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 text-white p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bot className="h-8 w-8" />
              {isVerifiedForm && (
                <Verified className="h-4 w-4 absolute -top-1 -right-1 text-green-400" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                IntelliForm AI V4.0 
                <span className="text-sm bg-white/20 px-2 py-1 rounded">LangChain</span>
              </h1>
              <p className="opacity-90">Verified Government Forms • AI Memory • Strict Validation</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm opacity-90">Current State</div>
              <div className="font-semibold flex items-center gap-1">
                {states[sessionState] || sessionState}
                {isVerifiedForm && <Shield className="h-4 w-4 text-green-400" />}
              </div>
              {sessionInfo?.progress && (
                <div className="text-xs opacity-75">Progress: {sessionInfo.progress}</div>
              )}
              {confidence !== null && (
                <div className="text-xs opacity-75">Confidence: {Math.round(confidence * 100)}%</div>
              )}
            </div>
            <div className={`px-3 py-1 rounded-full text-xs flex items-center gap-1 ${
              sessionState === 'COMPLETE' ? 'bg-green-500' : 
              sessionState === 'COLLECTING' ? 'bg-yellow-500' : 'bg-blue-500'
            }`}>
              {sessionState}
              {isVerifiedForm && <Verified className="h-3 w-3" />}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Main Chat Interface */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-lg h-[600px] flex flex-col">
            
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                    message.type === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    <div className="flex items-start gap-2">
                      {message.type === 'bot' && (
                        <div className="relative">
                          <Bot className="h-4 w-4 mt-1 text-blue-600" />
                          {message.metadata?.verified && (
                            <Verified className="h-3 w-3 absolute -top-1 -right-1 text-green-600" />
                          )}
                        </div>
                      )}
                      {message.type === 'user' && <User className="h-4 w-4 mt-1" />}
                      <div className="flex-1">
                        <p className="text-sm whitespace-pre-line">{message.content}</p>
                        
                        {/* PDF Generation Button for verified forms */}
                        {message.metadata?.canGeneratePDF && (
                          <button
                            onClick={generateVerifiedPDF}
                            disabled={isGeneratingPDF}
                            className="mt-2 flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                          >
                            <div className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              <Verified className="h-3 w-3" />
                            </div>
                            {isGeneratingPDF ? 'Generating Verified PDF...' : 'Generate Verified PDF'}
                          </button>
                        )}
                        
                        {/* Confidence indicator */}
                        {message.metadata?.confidence && (
                          <div className="text-xs opacity-70 mt-1 flex items-center gap-1">
                            <span>Confidence: {Math.round(message.metadata.confidence * 100)}%</span>
                            {message.metadata.verified && <Verified className="h-3 w-3 text-green-600" />}
                          </div>
                        )}
                        
                        <p className="text-xs opacity-70 mt-1">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {isProcessing && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 text-gray-800 px-4 py-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-blue-600" />
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                      <span className="text-sm">LangChain AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="border-t p-4">
              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  <div className="font-medium">Recent validation issues:</div>
                  {validationErrors.slice(-2).map((error, index) => (
                    <div key={index} className="text-xs">• {error}</div>
                  ))}
                </div>
              )}
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !isProcessing && processUserInput()}
                  placeholder="Type your message... (LangChain will validate and remember context)"
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  disabled={isProcessing}
                />
                <button
                  onClick={processUserInput}
                  disabled={isProcessing || !currentInput.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced System Dashboard */}
        <div className="space-y-6">
          
          {/* LangChain System Status */}
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              LangChain Status V4.0
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>LangChain API</span>
                <span className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${
                  backendConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {backendConnected ? (
                    <>V4.0 Connected <Verified className="h-3 w-3" /></>
                  ) : (
                    'Disconnected'
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Verified Forms</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                  {verifiedForms.length} Forms
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Session ID</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-mono">
                  {sessionId ? sessionId.substring(0, 8) : 'Not Set'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Current Form</span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  isVerifiedForm ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {isVerifiedForm ? '✅ Verified' : 'None'}
                </span>
              </div>
            </div>
            
            <button
              onClick={testLangChainConnection}
              className="w-full mt-3 px-3 py-2 bg-purple-600 text-white rounded text-xs hover:bg-purple-700"
            >
              Test LangChain Connection
            </button>
          </div>

          {/* Generated Files with Verification Status */}
          {generatedFiles.length > 0 && (
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <File className="h-4 w-4" />
                Generated Files
              </h3>
              <div className="space-y-3">
                {generatedFiles.map((file, index) => (
                  <div key={index} className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm truncate flex items-center gap-1">
                        {file.formName}
                        {file.verified && <Verified className="h-4 w-4 text-green-600" />}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(file.generatedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mb-2">
                      {file.filename}
                    </div>
                    {file.verified && (
                      <div className="text-xs text-green-600 mb-2 flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        Generated from verified government data
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => downloadFile(file.filename, file.downloadUrl)}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </button>
                      <button
                        onClick={() => previewFile(file.filename)}
                        className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                      >
                        <Eye className="h-3 w-3" />
                        Preview
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verified Forms List */}
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Database className="h-4 w-4" />
              Verified Forms
            </h3>
            <div className="space-y-2 text-sm">
              {verifiedForms.map((form, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Verified className="h-3 w-3 text-green-600" />
                  <span className="truncate">{form.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                  <span className="text-xs bg-green-100 text-green-700 px-1 rounded">Verified</span>
                </div>
              ))}
            </div>
          </div>

          {/* System Logs */}
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              System Logs
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {systemLogs.map((log, index) => (
                <div key={index} className="text-xs bg-gray-50 p-2 rounded">
                  <div className="font-mono text-gray-500">{log.timestamp}</div>
                  <div className="font-semibold">{log.action}</div>
                  <div className="text-gray-600 truncate">{log.details}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h3 className="font-semibold mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {sessionState === 'COMPLETE' && (
                <button
                  onClick={generateVerifiedPDF}
                  disabled={isGeneratingPDF}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                >
                  <FileText className="h-4 w-4" />
                  <Verified className="h-4 w-4" />
                  {isGeneratingPDF ? 'Generating...' : 'Generate Verified PDF'}
                </button>
              )}
              
              <button
                onClick={resetSession}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
              >
                Reset LangChain Session
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LangChainIntelliForm;