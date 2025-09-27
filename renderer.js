const { ipcRenderer } = require('electron');

class NotchOverlay {
    constructor() {
        this.timerDuration = 30; // 30 seconds
        this.currentTime = this.timerDuration;
        this.timerInterval = null;
        this.isTimerRunning = false;
        this.selectedChip = null;
        this.contextMessages = [
            'Dynamic Island Active',
            'Processing Request',
            'Task Completed',
            'Timer Running',
            'System Ready',
            'Monitoring Activity'
        ];

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeTimer();
        this.startContextRotation();
        // Fade-in animation will be triggered by main process
    }

    setupEventListeners() {
        // Chip interactions
        document.querySelectorAll('.chip').forEach((chip, index) => {
            chip.addEventListener('click', () => this.handleChipClick(chip, index + 1));
            chip.addEventListener('mouseenter', () => this.handleChipHover(chip));
            chip.addEventListener('mouseleave', () => this.handleChipLeave(chip));
        });

        // Arrow button interactions
        const upArrow = document.getElementById('up-arrow');
        const downArrow = document.getElementById('down-arrow');

        upArrow.addEventListener('click', () => this.handleUpArrow());
        downArrow.addEventListener('click', () => this.handleDownArrow());

        // Timer interactions
        const timerContainer = document.getElementById('timer-container');
        timerContainer.addEventListener('click', () => this.toggleTimer());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Window focus/blur events
        window.addEventListener('focus', () => this.handleWindowFocus());
        window.addEventListener('blur', () => this.handleWindowBlur());

        // Listen for fade animation events from main process
        ipcRenderer.on('fade-in', () => {
            console.log('Fade-in animation triggered');
            this.triggerNotchEmergence();
        });
        ipcRenderer.on('fade-out', () => {
            console.log('Fade-out animation triggered');
            this.triggerNotchFadeOut();
        });
    }

    handleChipClick(chip, number) {
        // Remove previous selection
        if (this.selectedChip) {
            this.selectedChip.classList.remove('selected');
        }

        // Add selection and animation
        chip.classList.add('selected', 'expanding');
        this.selectedChip = chip;

        // Update context text
        this.updateContextText(`Chip ${number} Selected`);

        // Remove expanding animation after completion
        setTimeout(() => {
            chip.classList.remove('expanding');
        }, 300);

        // Add tactile feedback
        this.addTactileFeedback(chip);
    }

    handleChipHover(chip) {
        if (!chip.classList.contains('selected')) {
            chip.style.transform = 'scale(1.05)';
        }
    }

    handleChipLeave(chip) {
        if (!chip.classList.contains('selected')) {
            chip.style.transform = '';
        }
    }

    handleUpArrow() {
        this.updateContextText('Moving Up');
        this.addButtonAnimation('up-arrow');

        // Simulate action with visual feedback
        setTimeout(() => {
            this.updateContextText('Position Updated');
        }, 1000);
    }

    handleDownArrow() {
        this.updateContextText('Moving Down');
        this.addButtonAnimation('down-arrow');

        // Simulate action with visual feedback
        setTimeout(() => {
            this.updateContextText('Position Updated');
        }, 1000);
    }

    addButtonAnimation(buttonId) {
        const button = document.getElementById(buttonId);
        button.style.transform = 'scale(0.9)';

        setTimeout(() => {
            button.style.transform = '';
        }, 150);
    }

    toggleTimer() {
        if (this.isTimerRunning) {
            this.stopTimer();
        } else {
            this.startTimer();
        }
    }

    startTimer() {
        if (this.isTimerRunning) return;

        this.isTimerRunning = true;
        this.updateContextText('Timer Started');

        this.timerInterval = setInterval(() => {
            this.currentTime--;
            this.updateTimerDisplay();
            this.updateTimerProgress();

            if (this.currentTime <= 0) {
                this.completeTimer();
            }
        }, 1000);
    }

    stopTimer() {
        if (!this.isTimerRunning) return;

        this.isTimerRunning = false;
        clearInterval(this.timerInterval);
        this.updateContextText('Timer Stopped');
    }

    resetTimer() {
        this.stopTimer();
        this.currentTime = this.timerDuration;
        this.updateTimerDisplay();
        this.updateTimerProgress();
        this.updateContextText('Timer Reset');
    }

    completeTimer() {
        this.isTimerRunning = false;
        clearInterval(this.timerInterval);

        // Add completion animation
        const timerContainer = document.getElementById('timer-container');
        timerContainer.classList.add('timer-complete');

        this.updateContextText('Timer Complete!');

        // Reset after animation
        setTimeout(() => {
            timerContainer.classList.remove('timer-complete');
            this.resetTimer();
        }, 500);
    }

    updateTimerDisplay() {
        const timerText = document.getElementById('timer-text');
        timerText.textContent = this.currentTime;
    }

    updateTimerProgress() {
        const progressCircle = document.getElementById('timer-progress');
        const circumference = 87.96; // 2 * π * 14 (radius)
        const progress = (this.timerDuration - this.currentTime) / this.timerDuration;
        const offset = circumference * (1 - progress);

        progressCircle.style.strokeDashoffset = offset;
    }

    initializeTimer() {
        this.updateTimerDisplay();
        this.updateTimerProgress();
    }

    updateContextText(text) {
        const contextText = document.getElementById('context-text');
        contextText.classList.add('updated');
        contextText.textContent = text;

        setTimeout(() => {
            contextText.classList.remove('updated');
        }, 600);
    }

    startContextRotation() {
        let messageIndex = 0;

        setInterval(() => {
            if (!this.isTimerRunning && !this.selectedChip) {
                messageIndex = (messageIndex + 1) % this.contextMessages.length;
                this.updateContextText(this.contextMessages[messageIndex]);
            }
        }, 5000);
    }

    addTactileFeedback(element) {
        // Add visual pulse effect
        element.classList.add('pulse');
        setTimeout(() => {
            element.classList.remove('pulse');
        }, 1000);
    }

    handleKeyboard(event) {
        switch(event.key) {
            case '1':
            case '2':
            case '3':
            case '4':
                const chipIndex = parseInt(event.key) - 1;
                const chip = document.querySelectorAll('.chip')[chipIndex];
                if (chip) this.handleChipClick(chip, parseInt(event.key));
                break;
            case ' ':
                event.preventDefault();
                this.toggleTimer();
                break;
            case 'r':
                this.resetTimer();
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.handleUpArrow();
                break;
            case 'ArrowDown':
                event.preventDefault();
                this.handleDownArrow();
                break;
            case 'Escape':
                ipcRenderer.send('toggle-window');
                break;
        }
    }

    handleWindowFocus() {
        // Window focus - animations are handled by main process
    }

    handleWindowBlur() {
        // Optional: Add subtle effects when window loses focus
    }

    animateEntrance() {
        const notchContent = document.getElementById('notch-content');
        // Remove any existing classes
        notchContent.classList.remove('animate-out', 'visible');

        // Force reflow
        notchContent.offsetHeight;

        // Add entrance animation
        notchContent.classList.add('animate-in');

        setTimeout(() => {
            notchContent.classList.remove('animate-in');
            notchContent.classList.add('visible');
        }, 500);
    }

    triggerNotchEmergence() {
        const notchContent = document.getElementById('notch-content');
        
        // Reset any existing animations
        notchContent.classList.remove('fade-in', 'fade-out');
        
        // Force reflow
        notchContent.offsetHeight;
        
        // Add the fade-in class to trigger the smooth animation
        notchContent.classList.add('fade-in');
    }

    triggerNotchFadeOut() {
        const notchContent = document.getElementById('notch-content');
        
        // Reset any existing animations
        notchContent.classList.remove('fade-in', 'fade-out');
        
        // Force reflow
        notchContent.offsetHeight;
        
        // Add the fade-out class to trigger the smooth exit animation
        notchContent.classList.add('fade-out');
    }

    animateExit() {
        const notchContent = document.getElementById('notch-content');
        notchContent.classList.remove('animate-in', 'visible');
        notchContent.classList.add('animate-out');

        setTimeout(() => {
            notchContent.classList.remove('animate-out');
        }, 300);
    }
}

// Device pixel ratio optimization for Retina displays
function optimizeForDisplay() {
    const dpr = window.devicePixelRatio || 1;
    const notchContent = document.getElementById('notch-content');

    if (dpr > 1) {
        // Retina display optimizations
        notchContent.style.transform = `scale(${1 / dpr})`;
        notchContent.style.transformOrigin = 'top center';
        document.body.style.zoom = dpr;
    }
}

// Performance monitoring
function initPerformanceMonitoring() {
    let frameCount = 0;
    let lastTime = performance.now();

    function checkFrameRate() {
        frameCount++;
        const currentTime = performance.now();

        if (currentTime - lastTime >= 1000) {
            const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));

            // Adjust animation quality based on performance
            if (fps < 30) {
                document.body.classList.add('reduced-animations');
            } else {
                document.body.classList.remove('reduced-animations');
            }

            frameCount = 0;
            lastTime = currentTime;
        }

        requestAnimationFrame(checkFrameRate);
    }

    requestAnimationFrame(checkFrameRate);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    optimizeForDisplay();
    initPerformanceMonitoring();

    // Create the main notch overlay instance
    window.notchOverlay = new NotchOverlay();

    // Handle system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
        // The notch is always dark, but we could adjust other elements here
        document.body.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    });
});

// Handle window before unload
window.addEventListener('beforeunload', () => {
    if (window.notchOverlay) {
        window.notchOverlay.stopTimer();
    }
});