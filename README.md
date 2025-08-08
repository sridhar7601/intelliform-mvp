# IntelliForm Frontend

IntelliForm AI Frontend - A React-based UI for interacting with the IntelliForm AI backend to complete government forms and generate PDFs.

## Overview

This frontend application provides a user-friendly interface for the IntelliForm AI system, which helps users complete government forms through an AI-assisted conversation and generates professional PDF documents ready for submission.

## Features

- Interactive chat interface for AI-assisted form completion
- Real-time form progress tracking
- PDF generation and preview capabilities
- File management for generated documents
- System status monitoring and logs
- Responsive design with Tailwind CSS

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- IntelliForm Backend running (see backend README)

## Installation

1. Clone the repository
2. Navigate to the frontend directory:
   ```
   cd intelliform-mvp
   ```
3. Install dependencies:
   ```
   npm install
   ```

## Running the Application

### Development Mode

```
npm start
```

This will start the development server at http://localhost:3000.

### Production Build

```
npm run build
```

This will create an optimized production build in the `build` directory.

## Configuration

The frontend is configured to connect to the backend at `http://localhost:3001` by default. If you need to change this, update the API endpoint URLs in the `IntelliFormMVP.js` component.

## Project Structure

- `src/` - Source code directory
  - `components/` - React components
    - `IntelliFormMVP.js` - Main application component
  - `App.js` - Root application component
  - `index.js` - Application entry point

## Using the Application

1. Start the backend server (see backend README)
2. Start the frontend development server
3. Open http://localhost:3000 in your browser
4. Begin a conversation with the AI assistant by typing in the chat input
5. Follow the AI's guidance to complete your chosen government form
6. Once the form is complete, generate a professional PDF
7. Download or preview the generated PDF

## Supported Government Forms

The application supports various Indian government forms including:
- PAN Card Application
- Driving License Application
- Passport Application
- And many more through dynamic form discovery

## User Interface

The UI consists of several key sections:

1. **Chat Interface** - The main area where you interact with the AI assistant
2. **System Status** - Shows the current state of the backend connection and session
3. **Generated Files** - Lists all PDFs generated during the current session
4. **Session Info** - Displays information about the current form completion progress
5. **Available Forms** - Shows the forms that are explicitly supported
6. **System Logs** - Provides technical information about system operations

## Troubleshooting

If you encounter issues:

1. Ensure the backend server is running
2. Check the System Logs section for error messages
3. Use the "Test Connection" button to verify backend connectivity
4. If the backend is disconnected, check your backend server logs

## Development

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app) and uses:
- React 19
- Tailwind CSS for styling
- Lucide React for icons
