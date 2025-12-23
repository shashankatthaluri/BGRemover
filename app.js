/**
 * BG Remover - Privacy-First Image Tools
 * 
 * Features:
 * 1. Background Remover - Uses ONNX Runtime with RMBG-1.4 model
 * 2. Watermark Tool - Add custom text watermarks with full control
 * 
 * All processing happens 100% client-side. No data ever leaves the browser.
 */

// ============================================
// Configuration
// ============================================

const CONFIG = {
    // Background Remover Model
    MODEL_URL: 'https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model.onnx',
    MODEL_INPUT_SIZE: 1024,
    MAX_IMAGE_DIMENSION: 2048,
    SUPPORTED_TYPES: ['image/png', 'image/jpeg', 'image/jpg'],
};

// ============================================
// State Management
// ============================================

const state = {
    // Background Remover
    session: null,
    originalImage: null,
    resultBlob: null,
    isProcessing: false,
    modelLoaded: false,

    // Watermark Tool
    watermarkImage: null,
    watermarkSettings: {
        text: '© BG Remover',
        position: 'bottom-right',
        fontSize: 32,
        color: '#ffffff',
        opacity: 50,
        font: 'Inter',
    },
};

// ============================================
// DOM Elements
// ============================================

const elements = {
    // Tool Tabs
    tabBgRemove: document.getElementById('tab-bg-remove'),
    tabWatermark: document.getElementById('tab-watermark'),
    toolBgRemove: document.getElementById('tool-bg-remove'),
    toolWatermark: document.getElementById('tool-watermark'),

    // Background Remover
    modelLoading: document.getElementById('model-loading'),
    modelProgress: document.getElementById('model-progress'),
    modelProgressText: document.getElementById('model-progress-text'),
    uploadSection: document.getElementById('upload-section'),
    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('file-input'),
    processingSection: document.getElementById('processing-section'),
    processingStatus: document.getElementById('processing-status'),
    processingProgress: document.getElementById('processing-progress'),
    resultSection: document.getElementById('result-section'),
    originalPreview: document.getElementById('original-preview'),
    resultPreview: document.getElementById('result-preview'),
    beforeBtn: document.getElementById('before-btn'),
    afterBtn: document.getElementById('after-btn'),
    previewBefore: document.getElementById('preview-before'),
    previewAfter: document.getElementById('preview-after'),
    downloadBtn: document.getElementById('download-btn'),
    newImageBtn: document.getElementById('new-image-btn'),
    processingCanvas: document.getElementById('processing-canvas'),
    outputCanvas: document.getElementById('output-canvas'),

    // Watermark Tool
    watermarkUpload: document.getElementById('watermark-upload'),
    watermarkDropZone: document.getElementById('watermark-drop-zone'),
    watermarkFileInput: document.getElementById('watermark-file-input'),
    watermarkEditor: document.getElementById('watermark-editor'),
    watermarkCanvas: document.getElementById('watermark-canvas'),
    watermarkText: document.getElementById('watermark-text'),
    watermarkPosition: document.getElementById('watermark-position'),
    watermarkSize: document.getElementById('watermark-size'),
    watermarkSizeValue: document.getElementById('watermark-size-value'),
    watermarkColor: document.getElementById('watermark-color'),
    watermarkColorValue: document.getElementById('watermark-color-value'),
    watermarkOpacity: document.getElementById('watermark-opacity'),
    watermarkOpacityValue: document.getElementById('watermark-opacity-value'),
    watermarkFont: document.getElementById('watermark-font'),
    watermarkResetBtn: document.getElementById('watermark-reset-btn'),
    watermarkDownloadBtn: document.getElementById('watermark-download-btn'),
};

// ============================================
// Tool Tab Navigation
// ============================================

function initToolTabs() {
    elements.tabBgRemove.addEventListener('click', () => switchTool('bg-remove'));
    elements.tabWatermark.addEventListener('click', () => switchTool('watermark'));
}

function switchTool(tool) {
    // Update tabs
    elements.tabBgRemove.classList.toggle('active', tool === 'bg-remove');
    elements.tabWatermark.classList.toggle('active', tool === 'watermark');

    // Update panels
    elements.toolBgRemove.classList.toggle('active', tool === 'bg-remove');
    elements.toolWatermark.classList.toggle('active', tool === 'watermark');
}

// ============================================
// ONNX Runtime & Background Remover
// ============================================

async function loadONNXRuntime() {
    return new Promise((resolve, reject) => {
        if (window.ort) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/ort.min.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load ONNX Runtime'));
        document.head.appendChild(script);
    });
}

async function initializeModel() {
    try {
        updateModelProgress(5, 'Loading ONNX Runtime...');
        await loadONNXRuntime();

        ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/';

        updateModelProgress(10, 'Downloading AI model...');

        const modelBuffer = await fetchModelWithProgress(CONFIG.MODEL_URL);

        updateModelProgress(90, 'Initializing model...');

        state.session = await ort.InferenceSession.create(modelBuffer, {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all',
        });

        state.modelLoaded = true;
        updateModelProgress(100, 'Ready!');

        setTimeout(() => {
            showBgRemoveSection('upload');
        }, 500);

    } catch (error) {
        console.error('Model initialization failed:', error);
        elements.modelProgressText.textContent = 'Error loading model. Please refresh.';
        elements.modelProgressText.style.color = '#ef4444';
    }
}

async function fetchModelWithProgress(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch model: ${response.status}`);
    }

    const contentLength = response.headers.get('content-length');
    const total = parseInt(contentLength, 10) || 50000000;

    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loaded += value.length;

        const downloadProgress = 10 + (loaded / total) * 80;
        updateModelProgress(downloadProgress, 'Downloading AI model...');
    }

    const modelBuffer = new Uint8Array(loaded);
    let position = 0;
    for (const chunk of chunks) {
        modelBuffer.set(chunk, position);
        position += chunk.length;
    }

    return modelBuffer.buffer;
}

function updateModelProgress(progress, status) {
    elements.modelProgress.style.width = `${progress}%`;
    elements.modelProgressText.textContent = `${Math.round(progress)}%`;
}

async function processBackgroundRemoval(file) {
    if (state.isProcessing) return;
    state.isProcessing = true;

    showBgRemoveSection('processing');
    updateProcessingStatus('Loading image...', 10);

    try {
        const image = await loadImage(file);
        state.originalImage = image;

        updateProcessingStatus('Preparing image...', 20);
        const resized = resizeImage(image, CONFIG.MAX_IMAGE_DIMENSION);

        updateProcessingStatus('Preprocessing...', 30);
        const inputTensor = preprocessImage(resized.canvas, CONFIG.MODEL_INPUT_SIZE);

        updateProcessingStatus('Running AI model...', 50);
        const feeds = { input: inputTensor };
        const results = await state.session.run(feeds);

        updateProcessingStatus('Generating mask...', 80);
        const outputData = results.output.data;

        updateProcessingStatus('Applying transparency...', 90);
        const resultCanvas = applyMask(resized.canvas, outputData, CONFIG.MODEL_INPUT_SIZE);

        updateProcessingStatus('Finalizing...', 95);
        state.resultBlob = await canvasToBlob(resultCanvas);

        displayBgRemoveResults(image, state.resultBlob);
        showBgRemoveSection('result');

    } catch (error) {
        console.error('Processing failed:', error);
        alert('Failed to process image. Please try again.');
        showBgRemoveSection('upload');
    } finally {
        state.isProcessing = false;
    }
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(img.src);
            resolve(img);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(file);
    });
}

function resizeImage(image, maxDim) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    let { width, height } = image;

    if (width > maxDim || height > maxDim) {
        if (width > height) {
            height = Math.round((height / width) * maxDim);
            width = maxDim;
        } else {
            width = Math.round((width / height) * maxDim);
            height = maxDim;
        }
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(image, 0, 0, width, height);

    return { canvas, width, height };
}

function preprocessImage(canvas, modelSize) {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = modelSize;
    tempCanvas.height = modelSize;

    tempCtx.drawImage(canvas, 0, 0, modelSize, modelSize);

    const imageData = tempCtx.getImageData(0, 0, modelSize, modelSize);
    const { data } = imageData;

    const tensorData = new Float32Array(1 * 3 * modelSize * modelSize);

    for (let i = 0; i < modelSize * modelSize; i++) {
        const pixelIndex = i * 4;
        tensorData[i] = data[pixelIndex] / 255.0;
        tensorData[modelSize * modelSize + i] = data[pixelIndex + 1] / 255.0;
        tensorData[2 * modelSize * modelSize + i] = data[pixelIndex + 2] / 255.0;
    }

    return new ort.Tensor('float32', tensorData, [1, 3, modelSize, modelSize]);
}

function applyMask(originalCanvas, maskData, modelSize) {
    const { width, height } = originalCanvas;

    const outputCanvas = elements.outputCanvas;
    const outputCtx = outputCanvas.getContext('2d');
    outputCanvas.width = width;
    outputCanvas.height = height;

    outputCtx.drawImage(originalCanvas, 0, 0);

    const imageData = outputCtx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    const maskCanvas = document.createElement('canvas');
    const maskCtx = maskCanvas.getContext('2d');
    maskCanvas.width = modelSize;
    maskCanvas.height = modelSize;

    const maskImageData = maskCtx.createImageData(modelSize, modelSize);
    for (let i = 0; i < modelSize * modelSize; i++) {
        const maskValue = Math.max(0, Math.min(1, maskData[i]));
        const alpha = Math.round(maskValue * 255);

        maskImageData.data[i * 4] = alpha;
        maskImageData.data[i * 4 + 1] = alpha;
        maskImageData.data[i * 4 + 2] = alpha;
        maskImageData.data[i * 4 + 3] = 255;
    }
    maskCtx.putImageData(maskImageData, 0, 0);

    const resizedMaskCanvas = document.createElement('canvas');
    const resizedMaskCtx = resizedMaskCanvas.getContext('2d');
    resizedMaskCanvas.width = width;
    resizedMaskCanvas.height = height;
    resizedMaskCtx.drawImage(maskCanvas, 0, 0, width, height);

    const resizedMaskData = resizedMaskCtx.getImageData(0, 0, width, height).data;

    for (let i = 0; i < width * height; i++) {
        const pixelIndex = i * 4;
        pixels[pixelIndex + 3] = resizedMaskData[pixelIndex];
    }

    outputCtx.putImageData(imageData, 0, 0);

    return outputCanvas;
}

function canvasToBlob(canvas) {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
}

function updateProcessingStatus(status, progress) {
    elements.processingStatus.textContent = status;
    elements.processingProgress.style.width = `${progress}%`;
}

function displayBgRemoveResults(originalImage, resultBlob) {
    elements.originalPreview.src = URL.createObjectURL(state.originalImage.src ?
        new Blob([]) : resultBlob);

    // Create a new object URL for the original
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = originalImage.width;
    tempCanvas.height = originalImage.height;
    tempCtx.drawImage(originalImage, 0, 0);
    tempCanvas.toBlob((blob) => {
        elements.originalPreview.src = URL.createObjectURL(blob);
    });

    elements.resultPreview.src = URL.createObjectURL(resultBlob);
    showAfterPreview();
}

function showBgRemoveSection(section) {
    elements.modelLoading.classList.add('hidden');
    elements.uploadSection.classList.add('hidden');
    elements.processingSection.classList.add('hidden');
    elements.resultSection.classList.add('hidden');

    switch (section) {
        case 'loading':
            elements.modelLoading.classList.remove('hidden');
            break;
        case 'upload':
            elements.uploadSection.classList.remove('hidden');
            break;
        case 'processing':
            elements.processingSection.classList.remove('hidden');
            break;
        case 'result':
            elements.resultSection.classList.remove('hidden');
            break;
    }
}

function showBeforePreview() {
    elements.beforeBtn.classList.add('active');
    elements.afterBtn.classList.remove('active');
    elements.previewBefore.classList.remove('hidden');
    elements.previewAfter.classList.add('hidden');
}

function showAfterPreview() {
    elements.afterBtn.classList.add('active');
    elements.beforeBtn.classList.remove('active');
    elements.previewAfter.classList.remove('hidden');
    elements.previewBefore.classList.add('hidden');
}

function resetBgRemover() {
    if (state.originalImage) {
        URL.revokeObjectURL(elements.originalPreview.src);
    }
    if (state.resultBlob) {
        URL.revokeObjectURL(elements.resultPreview.src);
    }

    state.originalImage = null;
    state.resultBlob = null;
    elements.fileInput.value = '';

    showBgRemoveSection('upload');
}

function downloadBgRemoveResult() {
    if (!state.resultBlob) return;

    const link = document.createElement('a');
    link.href = URL.createObjectURL(state.resultBlob);
    link.download = 'background-removed.png';
    link.click();

    setTimeout(() => URL.revokeObjectURL(link.href), 100);
}

// ============================================
// Watermark Tool
// ============================================

function initWatermarkTool() {
    // Drop zone events
    elements.watermarkDropZone.addEventListener('click', () => {
        elements.watermarkFileInput.click();
    });

    elements.watermarkDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.watermarkDropZone.classList.add('drag-over');
    });

    elements.watermarkDropZone.addEventListener('dragleave', () => {
        elements.watermarkDropZone.classList.remove('drag-over');
    });

    elements.watermarkDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.watermarkDropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        handleWatermarkFile(file);
    });

    elements.watermarkFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        handleWatermarkFile(file);
    });

    // Control events
    elements.watermarkText.addEventListener('input', updateWatermark);
    elements.watermarkPosition.addEventListener('change', updateWatermark);

    elements.watermarkSize.addEventListener('input', (e) => {
        state.watermarkSettings.fontSize = parseInt(e.target.value);
        elements.watermarkSizeValue.textContent = `${e.target.value}px`;
        updateWatermark();
    });

    elements.watermarkColor.addEventListener('input', (e) => {
        state.watermarkSettings.color = e.target.value;
        elements.watermarkColorValue.textContent = e.target.value;
        updateWatermark();
    });

    elements.watermarkOpacity.addEventListener('input', (e) => {
        state.watermarkSettings.opacity = parseInt(e.target.value);
        elements.watermarkOpacityValue.textContent = `${e.target.value}%`;
        updateWatermark();
    });

    elements.watermarkFont.addEventListener('change', (e) => {
        state.watermarkSettings.font = e.target.value;
        updateWatermark();
    });

    elements.watermarkResetBtn.addEventListener('click', resetWatermark);
    elements.watermarkDownloadBtn.addEventListener('click', downloadWatermarkedImage);
}

async function handleWatermarkFile(file) {
    if (!file) return;

    if (!CONFIG.SUPPORTED_TYPES.includes(file.type)) {
        alert('Please select a PNG or JPG image.');
        return;
    }

    try {
        const image = await loadImage(file);
        state.watermarkImage = image;

        // Show editor
        elements.watermarkUpload.classList.add('hidden');
        elements.watermarkEditor.classList.remove('hidden');

        // Draw initial watermark
        updateWatermark();
    } catch (error) {
        console.error('Failed to load image:', error);
        alert('Failed to load image. Please try again.');
    }
}

function updateWatermark() {
    if (!state.watermarkImage) return;

    const canvas = elements.watermarkCanvas;
    const ctx = canvas.getContext('2d');
    const image = state.watermarkImage;

    // Update settings from inputs
    state.watermarkSettings.text = elements.watermarkText.value || '© PixelForge';
    state.watermarkSettings.position = elements.watermarkPosition.value;

    // Set canvas size
    const maxWidth = 600;
    const maxHeight = 400;
    let { width, height } = image;

    if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
    }

    canvas.width = width;
    canvas.height = height;

    // Draw image
    ctx.drawImage(image, 0, 0, width, height);

    // Draw watermark
    drawWatermark(ctx, width, height);
}

function drawWatermark(ctx, width, height) {
    const { text, position, fontSize, color, opacity, font } = state.watermarkSettings;

    // Scale font size for preview
    const scaledFontSize = Math.max(12, Math.round(fontSize * (width / state.watermarkImage.width)));

    ctx.font = `${scaledFontSize}px ${font}`;
    ctx.fillStyle = hexToRgba(color, opacity / 100);
    ctx.textBaseline = 'middle';

    const padding = scaledFontSize;
    const textWidth = ctx.measureText(text).width;

    let x, y;

    if (position === 'tile') {
        // Tiled pattern
        ctx.textAlign = 'center';
        const stepX = textWidth + padding * 2;
        const stepY = scaledFontSize * 3;

        ctx.save();
        ctx.rotate(-Math.PI / 6);

        for (let row = -height; row < height * 2; row += stepY) {
            for (let col = -width; col < width * 2; col += stepX) {
                ctx.fillText(text, col, row);
            }
        }

        ctx.restore();
        return;
    }

    switch (position) {
        case 'top-left':
            x = padding;
            y = padding + scaledFontSize / 2;
            ctx.textAlign = 'left';
            break;
        case 'top-right':
            x = width - padding;
            y = padding + scaledFontSize / 2;
            ctx.textAlign = 'right';
            break;
        case 'bottom-left':
            x = padding;
            y = height - padding - scaledFontSize / 2;
            ctx.textAlign = 'left';
            break;
        case 'bottom-right':
            x = width - padding;
            y = height - padding - scaledFontSize / 2;
            ctx.textAlign = 'right';
            break;
        case 'center':
            x = width / 2;
            y = height / 2;
            ctx.textAlign = 'center';
            break;
        default:
            x = width - padding;
            y = height - padding - scaledFontSize / 2;
            ctx.textAlign = 'right';
    }

    // Draw shadow for better visibility
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.fillText(text, x, y);

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resetWatermark() {
    state.watermarkImage = null;
    elements.watermarkFileInput.value = '';

    // Reset controls
    elements.watermarkText.value = '© PixelForge';
    elements.watermarkPosition.value = 'bottom-right';
    elements.watermarkSize.value = 32;
    elements.watermarkSizeValue.textContent = '32px';
    elements.watermarkColor.value = '#ffffff';
    elements.watermarkColorValue.textContent = '#ffffff';
    elements.watermarkOpacity.value = 50;
    elements.watermarkOpacityValue.textContent = '50%';
    elements.watermarkFont.value = 'Inter';

    state.watermarkSettings = {
        text: '© PixelForge',
        position: 'bottom-right',
        fontSize: 32,
        color: '#ffffff',
        opacity: 50,
        font: 'Inter',
    };

    elements.watermarkEditor.classList.add('hidden');
    elements.watermarkUpload.classList.remove('hidden');
}

function downloadWatermarkedImage() {
    if (!state.watermarkImage) return;

    // Create full-resolution canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const image = state.watermarkImage;

    canvas.width = image.width;
    canvas.height = image.height;

    // Draw image at full resolution
    ctx.drawImage(image, 0, 0);

    // Draw watermark at full resolution
    const { text, position, fontSize, color, opacity, font } = state.watermarkSettings;

    ctx.font = `${fontSize}px ${font}`;
    ctx.fillStyle = hexToRgba(color, opacity / 100);
    ctx.textBaseline = 'middle';

    const padding = fontSize;
    const textWidth = ctx.measureText(text).width;

    let x, y;

    if (position === 'tile') {
        ctx.textAlign = 'center';
        const stepX = textWidth + padding * 2;
        const stepY = fontSize * 3;

        ctx.save();
        ctx.rotate(-Math.PI / 6);

        for (let row = -image.height; row < image.height * 2; row += stepY) {
            for (let col = -image.width; col < image.width * 2; col += stepX) {
                ctx.fillText(text, col, row);
            }
        }

        ctx.restore();
    } else {
        switch (position) {
            case 'top-left':
                x = padding;
                y = padding + fontSize / 2;
                ctx.textAlign = 'left';
                break;
            case 'top-right':
                x = image.width - padding;
                y = padding + fontSize / 2;
                ctx.textAlign = 'right';
                break;
            case 'bottom-left':
                x = padding;
                y = image.height - padding - fontSize / 2;
                ctx.textAlign = 'left';
                break;
            case 'bottom-right':
                x = image.width - padding;
                y = image.height - padding - fontSize / 2;
                ctx.textAlign = 'right';
                break;
            case 'center':
                x = image.width / 2;
                y = image.height / 2;
                ctx.textAlign = 'center';
                break;
            default:
                x = image.width - padding;
                y = image.height - padding - fontSize / 2;
                ctx.textAlign = 'right';
        }

        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        ctx.fillText(text, x, y);
    }

    // Download
    canvas.toBlob((blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'watermarked-image.png';
        link.click();

        setTimeout(() => URL.revokeObjectURL(link.href), 100);
    }, 'image/png');
}

// ============================================
// Background Remover Event Handlers
// ============================================

function initBgRemover() {
    // Drop zone events
    elements.dropZone.addEventListener('click', () => {
        elements.fileInput.click();
    });

    elements.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dropZone.classList.add('drag-over');
    });

    elements.dropZone.addEventListener('dragleave', () => {
        elements.dropZone.classList.remove('drag-over');
    });

    elements.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.dropZone.classList.remove('drag-over');

        const file = e.dataTransfer.files[0];
        handleBgRemoveFile(file);
    });

    elements.fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        handleBgRemoveFile(file);
    });

    // Preview toggle
    elements.beforeBtn.addEventListener('click', showBeforePreview);
    elements.afterBtn.addEventListener('click', showAfterPreview);

    // Actions
    elements.downloadBtn.addEventListener('click', downloadBgRemoveResult);
    elements.newImageBtn.addEventListener('click', resetBgRemover);
}

function handleBgRemoveFile(file) {
    if (!file) return;

    if (!CONFIG.SUPPORTED_TYPES.includes(file.type)) {
        alert('Please select a PNG or JPG image.');
        return;
    }

    if (file.size > 50 * 1024 * 1024) {
        alert('Image is too large. Please select an image under 50MB.');
        return;
    }

    processBackgroundRemoval(file);
}

// ============================================
// Smooth Scroll for Navigation
// ============================================

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// ============================================
// Initialize App
// ============================================

function init() {
    initToolTabs();
    initBgRemover();
    initWatermarkTool();
    initSmoothScroll();

    // Load the background removal model
    initializeModel();
}

// Start the application
init();
