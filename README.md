# Cloud Revit Data Manager

A cloud-based service designed to manage Revit model data, perform automated engineering calculations, and render interactive 3D visualizations.

## 🎯 Project Overview

This platform bridges the gap between BIM data extraction, cloud storage, and web-based interaction. By integrating directly with cloud environments, it eliminates manual file handling, automates complex calculations, and provides stakeholders with real-time visual insights inside a browser.

## ✨ Key Features

* **BIM Data Management**: Extract, filter, and sync Revit model parameters directly via cloud workflows.
* **Automated Calculations**: Run instant geometric, material, or structural logic checks on live model data.
* **Web Visualizations**: Render lightweight, interactive 3D models directly in the user interface.
* **Cloud Sync**: Secure, real-time access to models hosted in cloud repositories.

## 🏗 Tech Stack

* **Backend**: Node.js — handling high-concurrency API requests, data pipelines, and calculations.
* **Frontend**: React — driving a responsive, state-managed dashboard and UI components.
* **BIM Integration**: Autodesk SDK — powering model translation, property parsing, and cloud viewing.

## 🚀 Getting Started

1. **Environment**: Clone the repository and create a `.env` file with your Autodesk credentials.
2. **Installation**: Run `npm install` in both the root and client directories.
3. **Development**: Start the backend and frontend services using `npm run dev`.
