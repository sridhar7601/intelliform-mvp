import React, { useState, useEffect } from 'react';
import { MessageCircle, Bot, User, FileText, Download, Settings, Zap, Database, CheckCircle, Server, Clock, Users, File, Eye, Trash2 } from 'lucide-react';

const IntelliFormMVP = () => {
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

  // Government Forms Knowledge Base
  const governmentForms = {
    "pan_card": {
      name: "Permanent Account Number (PAN)",
      authority: "Income Tax Department",
      form_number: "Form 49A",
      fields: ["title", "full_name", "father_name", "dob", "gender", "address", "mobile", "email"],
      documents: ["Identity Proof", "Address Proof", "Date of Birth Proof"],
      fee: "₹110 (Indian address), ₹1020 (Foreign address)",
      processing_time: "15-20 working days",
      eligibility: "Any Indian citizen or entity"
    },
    "driving_license": {
      name: "Driving License",
      authority: "Regional Transport Office (RTO)",
      form_number: "Form 2 (Learner's), Form 4 (Permanent)",
      fields: ["license_type", "vehicle_class", "full_name", "father_name", "dob", "address", "mobile", "blood_group"],
      documents: ["Age Proof", "Address Proof", "Passport Size Photos", "Medical Certificate"],
      fee: "₹200 (Learner's), ₹500 (Permanent)",
      processing_time: "7-15 days",
      eligibility: "18+ years for car, 16+ for motorcycle"
    },
    "passport": {
      name: "Indian Passport",
      authority: "Ministry of External Affairs",
      form_number: "Online Application",
      fields: ["passport_type", "booklet_type", "full_name", "father_name", "mother_name", "dob", "place_of_birth", "address"],
      documents: ["Birth Certificate", "Address Proof", "Identity Proof"],
      fee: "₹1500 (36 pages), ₹2000 (60 pages)",
      processing_time: "30-45 days",
      eligibility: "Indian citizen"
    }
  };

  const states = {
    'INIT': 'Understanding your requirement',
    'COLLECTING': 'Collecting information',
    'COMPLETE': 'Form completed',
    'REVIEW': 'Reviewing details',
    'GENERATE': 'Generating form'
  };

  // Enhanced Backend API with Session Management
  const callBackendAPI = async (prompt, includeSessionId = true) => {
    try {
      addSystemLog(`🌐 Backend API Call`, `Session: ${sessionId || 'new'}, Message: "${prompt.substring(0, 50)}..."`);
      
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
        throw new Error(data.error || 'Backend API error');
      }

      // Update session info
      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
        addSystemLog(`🆔 Session Created`, `New session: ${data.sessionId}`);
      }
      
      if (data.sessionState) {
        setSessionInfo(data.sessionState);
        setSessionState(data.sessionState.state);
        
        if (data.sessionState.currentForm) {
          setFormContext({
            type: data.sessionState.currentForm,
            details: governmentForms[data.sessionState.currentForm]
          });
        }
      }

      addSystemLog(`✅ Backend Response`, `Intent: ${data.response.intent}, Actions: ${data.actions?.length || 0}`);
      
      return data;

    } catch (error) {
      addSystemLog(`❌ Backend Error`, error.message);
      setBackendConnected(false);
      
      return {
        success: false,
        response: {
          intent: 'clarification_needed',
          message: "I'm having trouble connecting to the backend. Please try again.",
          confidence: 0.1
        },
        actions: []
      };
    }
  };

  // NEW: Generate PDF function
  const generatePDF = async () => {
    if (!sessionId || sessionState !== 'COMPLETE') {
      addSystemLog(`❌ PDF Error`, 'Session not ready for PDF generation');
      return;
    }

    setIsGeneratingPDF(true);
    addSystemLog(`📄 PDF Generation`, `Starting PDF generation for ${formContext?.type}`);

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
        addSystemLog(`✅ PDF Generated`, `File: ${data.filename}`);
        
        // Add generated file to list
        setGeneratedFiles(prev => [...prev, {
          filename: data.filename,
          downloadUrl: `http://localhost:3001${data.downloadUrl}`,
          formType: data.formType,
          formName: data.formName,
          generatedAt: data.generatedAt
        }]);

        addMessage('bot', `📄 **Professional PDF Generated!**

Your ${data.formName} application has been generated as a professional PDF document with official formatting.

**File Details:**
• Filename: ${data.filename}
• Form Type: ${data.formName}
• Generated: ${new Date(data.generatedAt).toLocaleString()}

You can download or preview your form using the buttons below.`, {
          pdfGenerated: true,
          filename: data.filename,
          downloadUrl: data.downloadUrl
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

  // NEW: Download file function
  const downloadFile = (filename, downloadUrl) => {
    addSystemLog(`💾 Download`, `Downloading: ${filename}`);
    window.open(downloadUrl, '_blank');
  };

  // NEW: Preview file function
  const previewFile = (filename) => {
    addSystemLog(`👁️ Preview`, `Previewing: ${filename}`);
    const previewUrl = `http://localhost:3001/api/preview/${filename}`;
    window.open(previewUrl, '_blank');
  };

  // Check backend health
  const checkBackendHealth = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/health');
      if (response.ok) {
        const data = await response.json();
        setBackendConnected(true);
        addSystemLog(`✅ Backend Health`, `V3.0 running, ${data.sessions} sessions, PDF enabled`);
        return true;
      }
    } catch (error) {
      setBackendConnected(false);
      addSystemLog(`❌ Backend Health`, 'Backend server not reachable');
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

  const processUserInput = async () => {
    if (!currentInput.trim()) return;
    
    const userMessage = currentInput.trim();
    setCurrentInput('');
    setIsProcessing(true);
    
    addMessage('user', userMessage);
    addSystemLog(`👤 User Input`, userMessage);
    
    try {
      const result = await callBackendAPI(userMessage);
      
      if (!result.success) {
        addMessage('bot', result.response.message);
        setIsProcessing(false);
        return;
      }
      
      const { response, actions } = result;
      
      addSystemLog(`🧠 AI Response`, `Intent: ${response.intent}, Form: ${response.form_type || 'none'}`);
      
      addMessage('bot', response.message, {
        intent: response.intent,
        form_type: response.form_type,
        confidence: response.confidence
      });
      
      if (actions && actions.length > 0) {
        for (const action of actions) {
          setTimeout(() => {
            processAction(action);
          }, 1000);
        }
      }
      
    } catch (error) {
      addSystemLog(`❌ Error`, error.message);
      addMessage('bot', 'I encountered an error processing your request. Please try again.');
    }
    
    setIsProcessing(false);
  };

 // Replace your existing processAction function with this enhanced version
// that handles ANY government form dynamically

const processAction = (action) => {
  switch (action.type) {
    // NEW: Universal form start action
    case 'start_universal_form':
      addSystemLog(`📋 Universal Form Started`, `${action.formType}: ${action.formDetails.name}`);
      
      // Store form details in state
      setFormContext({
        type: action.formType,
        details: action.formDetails,
        isUniversal: true // Flag to indicate this is a dynamically discovered form
      });
      
      setTimeout(() => {
        addMessage('bot', `📋 **${action.formDetails.name} Application Started**

**Authority:** ${action.formDetails.authority}
**Form Number:** ${action.formDetails.form_number}
**Total Fields:** ${action.formDetails.total_fields}
**Processing Time:** ${action.formDetails.processing_time}
**Fees:** ${action.formDetails.fees}

**Required Documents:**
${action.formDetails.documents_needed.map(doc => `• ${doc}`).join('\n')}

Let's start collecting the required information:

${action.nextQuestion}`, {
          formStarted: true,
          formType: action.formType,
          universalForm: true
        });
      }, 500);
      break;

    // NEW: Universal question asking action
    case 'ask_universal_question':
      addSystemLog(`❓ Universal Question`, `Field: ${action.fieldName} (${action.fieldNumber}/${action.totalFields})`);
      
      // Create a more informative question with progress
      const progressText = `**Progress: ${action.fieldNumber}/${action.totalFields}** 📊

${action.question}`;
      
      setTimeout(() => {
        addMessage('bot', progressText, {
          fieldType: action.fieldName,
          fieldNumber: action.fieldNumber,
          totalFields: action.totalFields,
          universalForm: true
        });
      }, 500);
      break;

    // NEW: Universal form completion action
    case 'universal_form_complete':
      addSystemLog(`✅ Universal Form Complete`, `${action.formDetails.name} - ${Object.keys(action.formData).length} fields collected`);
      setCollectedData(action.formData);
      
      setTimeout(() => {
        addMessage('bot', `🎉 **${action.formDetails.name} Application Completed!**

I have successfully collected all the required information for your application.

**Summary of Information Collected:**
${Object.entries(action.formData).map(([key, value]) => 
  `• **${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:** ${value}`
).join('\n')}

**Next Steps:**
1. **Generate Professional PDF** - Click the button below to create a government-ready form
2. **Review Information** - The PDF will include all your details in official format
3. **Print & Submit** - Take the PDF to ${action.formDetails.authority}

**Required Documents to Carry:**
${action.formDetails.documents_needed.map(doc => `• ${doc}`).join('\n')}

**Processing Information:**
• **Fees:** ${action.formDetails.fees}
• **Processing Time:** ${action.formDetails.processing_time}
• **Form Number:** ${action.formDetails.form_number}

Would you like me to generate the professional PDF now?`, {
          formComplete: true,
          formType: action.formType,
          canGeneratePDF: true,
          universalForm: true,
          formDetails: action.formDetails
        });
      }, 1000);
      break;

    // Enhanced validation error handling
    case 'validation_error':
      addSystemLog(`⚠️ Validation Error`, action.message);
      
      setTimeout(() => {
        addMessage('bot', `⚠️ **Input Validation Issue**

${action.message}

${action.retry_question || 'Please provide the correct information.'}`, {
          validationError: true,
          retryRequired: true
        });
      }, 500);
      break;

    // Enhanced clarification handling
    case 'clarification_needed':
      addSystemLog(`❓ Clarification Required`, action.message);
      
      setTimeout(() => {
        addMessage('bot', `❓ **Need More Information**

${action.message}

**I can help you with popular government forms like:**
• FSSAI Food License
• GST Registration  
• Company Registration
• Trademark Registration
• PAN Card Application
• Passport Application
• Driving License
• And many more!

Just tell me which specific form or certificate you need.`, {
          clarificationNeeded: true,
          needsFormSpecification: true
        });
      }, 500);
      break;

    // LEGACY: Keep existing form start for backwards compatibility
    case 'start_form':
      addSystemLog(`📋 Legacy Form Started`, `${action.formType}: ${action.nextQuestion}`);
      
      // Check if this is a known legacy form
      const legacyForm = governmentForms[action.formType];
      if (legacyForm) {
        setFormContext({
          type: action.formType,
          details: legacyForm,
          isUniversal: false
        });
      }
      
      setTimeout(() => {
        addMessage('bot', action.nextQuestion, {
          formStarted: true,
          formType: action.formType,
          legacyForm: true
        });
      }, 500);
      break;
        
    // LEGACY: Keep existing question asking for backwards compatibility
    case 'ask_next_question':
      addSystemLog(`❓ Legacy Question`, `Field type: ${action.fieldType}`);
      
      let questionText = action.question;
      if (action.options && action.options.length > 0) {
        questionText += '\n\nOptions:\n' + action.options.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n');
      }
      
      addMessage('bot', questionText, {
        fieldType: action.fieldType,
        options: action.options,
        legacyForm: true
      });
      break;
        
    // LEGACY: Keep existing form complete for backwards compatibility  
    case 'form_complete':
      addSystemLog(`✅ Legacy Form Complete`, `Collected ${Object.keys(action.formData).length} fields`);
      setCollectedData(action.formData);
      
      const legacyFormDetails = governmentForms[action.formType];
      
      setTimeout(() => {
        addMessage('bot', `🎉 **Form Completed Successfully!**

I have collected all the required information for your ${legacyFormDetails?.name} application.

**Next Steps:**
1. **Generate Professional PDF** - Click the button below to create a properly formatted government form
2. **Review Information** - Preview your form before submitting
3. **Download & Submit** - Take the PDF to the respective government office

Would you like me to generate the professional PDF form now?`, {
          formComplete: true,
          formType: action.formType,
          canGeneratePDF: true,
          legacyForm: true
        });
      }, 1000);
      break;

    // Handle unknown actions gracefully
    default:
      console.log('Unknown action type:', action.type, action);
      addSystemLog(`❓ Unknown Action`, `Type: ${action.type}`);
      
      // Try to handle it as a generic message
      if (action.message) {
        setTimeout(() => {
          addMessage('bot', action.message, {
            unknownAction: true,
            actionType: action.type
          });
        }, 500);
      }
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
    
    addMessage('bot', 'Hello! I\'m IntelliForm AI V3.0, your advanced government form assistant with PDF generation capabilities. I can help you complete any government form and generate professional PDF documents ready for submission. What do you need help with today?');
    
    addSystemLog(`🔄 Session Reset`, 'New conversation started');
  };

  const testBackendConnection = async () => {
    addSystemLog(`🧪 Testing Backend`, `Attempting V3.0 connection...`);
    const isConnected = await checkBackendHealth();
    
    if (isConnected) {
      try {
        const testResponse = await callBackendAPI("Test V3.0 connection", false);
        addSystemLog(`✅ Test Success`, `V3.0 backend with PDF generation ready!`);
      } catch (error) {
        addSystemLog(`❌ Test Failed`, error.message);
      }
    }
  };

  useEffect(() => {
    checkBackendHealth();
    resetSession();
    
    const healthCheckInterval = setInterval(checkBackendHealth, 30000);
    
    return () => clearInterval(healthCheckInterval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">IntelliForm AI V3.0</h1>
              <p className="opacity-90">Professional PDF Generation & Government Form Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm opacity-90">Current State</div>
              <div className="font-semibold">{states[sessionState] || sessionState}</div>
              {sessionInfo?.progress && (
                <div className="text-xs opacity-75">Progress: {sessionInfo.progress}</div>
              )}
            </div>
            <div className={`px-3 py-1 rounded-full text-xs ${
              sessionState === 'COMPLETE' ? 'bg-green-500' : 
              sessionState === 'COLLECTING' ? 'bg-yellow-500' : 'bg-blue-500'
            }`}>
              {sessionState}
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
                      {message.type === 'bot' && <Bot className="h-4 w-4 mt-1 text-blue-600" />}
                      {message.type === 'user' && <User className="h-4 w-4 mt-1" />}
                      <div>
                        <p className="text-sm whitespace-pre-line">{message.content}</p>
                        
                        {/* PDF Generation Button */}
                        {message.metadata?.canGeneratePDF && (
                          <button
                            onClick={generatePDF}
                            disabled={isGeneratingPDF}
                            className="mt-2 flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                          >
                            <FileText className="h-3 w-3" />
                            {isGeneratingPDF ? 'Generating PDF...' : 'Generate Professional PDF'}
                          </button>
                        )}
                        
                        {message.metadata?.confidence && (
                          <div className="text-xs opacity-70 mt-1">
                            Confidence: {Math.round(message.metadata.confidence * 100)}%
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
                      <span className="text-sm">AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="border-t p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !isProcessing && processUserInput()}
                  placeholder="Type your message... (e.g., 'I need a PAN card' or answer the current question)"
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
          
          {/* System Status */}
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              System Status V3.0
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Backend API</span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  backendConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {backendConnected ? 'V3.0 Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>PDF Engine</span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  backendConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {backendConnected ? 'Ready' : 'Offline'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Session ID</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-mono">
                  {sessionId ? sessionId.substring(0, 8) : 'Not Set'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Claude AI</span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  backendConnected ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {backendConnected ? 'Session-Aware' : 'Mock'}
                </span>
              </div>
            </div>
            
            {/* Test Connection Button */}
            <button
              onClick={testBackendConnection}
              className="w-full mt-3 px-3 py-2 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
            >
              Test V3.0 Connection
            </button>
          </div>

          {/* Generated Files */}
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
                      <span className="font-medium text-sm truncate">{file.formName}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(file.generatedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mb-2">
                      {file.filename}
                    </div>
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

          {/* Session Info */}
          {sessionInfo && (
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Session Info
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Current Form</span>
                  <span className="text-blue-600 font-medium">
                    {sessionInfo.currentForm ? governmentForms[sessionInfo.currentForm]?.name || sessionInfo.currentForm : 'None'}
                  </span>
                </div>
                {sessionInfo.progress && (
                  <div className="flex items-center justify-between">
                    <span>Progress</span>
                    <span className="text-green-600 font-medium">{sessionInfo.progress}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>State</span>
                  <span className="text-purple-600 font-medium">{sessionInfo.state}</span>
                </div>
                {sessionState === 'COMPLETE' && (
                  <div className="mt-2 p-2 bg-green-50 rounded">
                    <div className="flex items-center gap-1 text-green-700 text-xs">
                      <CheckCircle className="h-3 w-3" />
                      Form ready for PDF generation
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Available Forms */}
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Database className="h-4 w-4" />
              Available Forms
            </h3>
            <div className="space-y-2 text-sm">
              {Object.entries(governmentForms).map(([key, form]) => (
                <div key={key} className="flex items-center gap-2">
                  <FileText className="h-3 w-3 text-gray-400" />
                  <span className="truncate">{form.name}</span>
                  <span className="text-xs text-gray-500">({form.fields.length} fields)</span>
                  <span className="text-xs bg-green-100 text-green-700 px-1 rounded">PDF</span>
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
                  onClick={generatePDF}
                  disabled={isGeneratingPDF}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                >
                  <FileText className="h-4 w-4" />
                  {isGeneratingPDF ? 'Generating...' : 'Generate PDF'}
                </button>
              )}
              
              <button
                onClick={resetSession}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
              >
                Reset Session
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntelliFormMVP;