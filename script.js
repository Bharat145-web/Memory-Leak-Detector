
let memoryChart = null;
let timelineChart = null;
let currentAnalysis = null;
let selectedLanguage = 'c'; // Default language
let isAnalyzing = false; // Flag to prevent multiple simultaneous analyses
let analysisTimeout = null; // For debouncing

function updateLanguage() {
    try {
        const languageSelect = document.getElementById('languageSelect');
        if (!languageSelect) {
            debugError('Language select element not found');
            return;
        }

        selectedLanguage = languageSelect.value;
        const codeEditor = document.getElementById('codeEditor');
        
        const placeholders = {
            'c': 'Enter your C code here...',
            'cpp': 'Enter your C++ code here...',
            'javascript': 'Enter your JavaScript code here...',
            'python': 'Enter your Python code here...',
            'java': 'Enter your Java code here...',
            'rust': 'Enter your Rust code here...',
            'go': 'Enter your Go code here...',
            'html': 'Enter your HTML code here...',
            'css': 'Enter your CSS code here...',
            'other': 'Enter your code here...'
        };
        
        if (codeEditor) {
            codeEditor.placeholder = placeholders[selectedLanguage] || 'Enter your code here...';
        }
        
        debugLog('Language changed to:', selectedLanguage);
    } catch (error) {
        debugError('Error updating language:', error);
        notifications.error('Failed to update language selection');
    }
}


function clearEditor() {
    try {
        const codeEditor = document.getElementById('codeEditor');
        if (codeEditor) {
            codeEditor.value = '';
        }
        resetDashboard();
        notifications.info('Editor cleared');
    } catch (error) {
        debugError('Error clearing editor:', error);
        notifications.error('Failed to clear editor');
    }
}

function resetDashboard() {
    try {
        const elements = {
            totalAllocations: document.getElementById('totalAllocations'),
            totalFrees: document.getElementById('totalFrees'),
            memoryLeaks: document.getElementById('memoryLeaks'),
            leakedBytes: document.getElementById('leakedBytes'),
            criticalIssues: document.getElementById('criticalIssues'),
            leaksList: document.getElementById('leaksList'),
            analysisContent: document.getElementById('analysisContent')
        };

        if (elements.totalAllocations) elements.totalAllocations.textContent = '0 calls';
        if (elements.totalFrees) elements.totalFrees.textContent = '0 calls';
        if (elements.memoryLeaks) elements.memoryLeaks.textContent = '0 leaks';
        if (elements.leakedBytes) elements.leakedBytes.textContent = '0 B';
        if (elements.criticalIssues) elements.criticalIssues.textContent = '0 issues';

        
        const defaultMessage = '<p class="text-gray-500 text-center py-8">No analysis performed yet. Click "Analyze Memory" to start.</p>';
        if (elements.leaksList) elements.leaksList.innerHTML = defaultMessage;
        if (elements.analysisContent) elements.analysisContent.innerHTML = defaultMessage;

        if (memoryChart) {
            memoryChart.destroy();
            memoryChart = null;
        }
        if (timelineChart) {
            timelineChart.destroy();
            timelineChart = null;
        }

        const timelineTab = document.getElementById('timeline-tab');
        if (timelineTab) {
            const existingMsg = timelineTab.querySelector('.no-timeline-msg');
            if (existingMsg) {
                existingMsg.remove();
            }
        }

        currentAnalysis = null;
    } catch (error) {
        debugError('Error resetting dashboard:', error);
        notifications.error('Failed to reset dashboard');
    }
}


function showLoading() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) {
        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = '<span class="inline-block animate-spin mr-2">⏳</span>Analyzing...';
    }
}

function hideLoading() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) {
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = 'Analyze Memory';
    }
}

function analyzeCode() {
    try {
        
        if (isAnalyzing) {
            notifications.warning('Analysis already in progress. Please wait...');
            return;
        }

        if (analysisTimeout) {
            clearTimeout(analysisTimeout);
        }

        analysisTimeout = setTimeout(() => {
            performAnalysisInternal();
        }, CONFIG.UI.DEBOUNCE_DELAY);
    } catch (error) {
        debugError('Error in analyzeCode:', error);
        notifications.error('Failed to start analysis: ' + error.message);
        hideLoading();
    }
}


function performAnalysisInternal() {
    try {
        const codeEditor = document.getElementById('codeEditor');
        if (!codeEditor) {
            notifications.error('Code editor not found');
            return;
        }

        const code = codeEditor.value.trim();
        
        
        if (!code) {
            notifications.warning('Please enter some code to analyze.');
            return;
        }

        if (code.length > 100000) {
            notifications.warning('Code is too large. Please analyze smaller code sections.');
            return;
        }

        const languageSelect = document.getElementById('languageSelect');
        if (!languageSelect) {
            notifications.error('Language selector not found');
            return;
        }

        const language = languageSelect.value;

        isAnalyzing = true;
        showLoading();

        let analysis;
        try {
            analysis = performAnalysis(code, language);
        } catch (error) {
            debugError('Analysis error:', error);
            notifications.error('Analysis failed: ' + error.message);
            hideLoading();
            isAnalyzing = false;
            return;
        }

        if (!analysis) {
            notifications.error('Analysis returned no results');
            hideLoading();
            isAnalyzing = false;
            return;
        }

        currentAnalysis = analysis;
        updateDashboard(analysis);
        updateLeaksTab(analysis);
        updateAnalysisTab(analysis);
        updateTimelineChart(analysis);

        if (typeof saveToHistory === 'function') {
            try {
                saveToHistory(analysis, code, language);
            } catch (error) {
                debugError('Error saving to history:', error);
            }
        }

        const leakCount = analysis.leaks ? analysis.leaks.length : 0;
        if (leakCount === 0) {
            notifications.success('Analysis complete! No memory leaks detected. ✓');
        } else {
            notifications.warning(`Analysis complete! Found ${leakCount} memory leak(s).`);
        }

        hideLoading();
        isAnalyzing = false;
    } catch (error) {
        debugError('Error in performAnalysisInternal:', error);
        notifications.error('Analysis failed: ' + error.message);
        hideLoading();
        isAnalyzing = false;
    }
}


function exportAnalysis() {
    try {
        if (!currentAnalysis) {
            notifications.warning('No analysis to export. Please analyze code first.');
            return;
        }

        const exportData = {
            timestamp: new Date().toISOString(),
            language: selectedLanguage,
            statistics: {
                totalAllocations: currentAnalysis.allocations ? currentAnalysis.allocations.length : 0,
                totalFrees: currentAnalysis.frees ? currentAnalysis.frees.length : 0,
                memoryLeaks: currentAnalysis.leaks ? currentAnalysis.leaks.length : 0,
                leakedBytes: currentAnalysis.leaks ? currentAnalysis.leaks.reduce((sum, leak) => sum + (leak.size || 0), 0) : 0,
                warnings: currentAnalysis.warnings ? currentAnalysis.warnings.length : 0
            },
            allocations: currentAnalysis.allocations || [],
            frees: currentAnalysis.frees || [],
            leaks: currentAnalysis.leaks || [],
            warnings: currentAnalysis.warnings || [],
            timeline: currentAnalysis.timeline || []
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `memory-analysis-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        notifications.success('Analysis exported successfully!');
    } catch (error) {
        debugError('Error exporting analysis:', error);
        notifications.error('Failed to export analysis: ' + error.message);
    }
}


function updateEditorStats() {
    try {
        const codeEditor = document.getElementById('codeEditor');
        const lineCountEl = document.getElementById('lineCount');
        const charCountEl = document.getElementById('charCount');
        
        if (!codeEditor) return;
        
        const code = codeEditor.value;
        const lines = code.split('\n').length;
        const chars = code.length;
        
        if (lineCountEl) {
            lineCountEl.textContent = `${lines} line${lines !== 1 ? 's' : ''}`;
        }
        
        if (charCountEl) {
            charCountEl.textContent = `${chars} character${chars !== 1 ? 's' : ''}`;
        }
    } catch (error) {
        debugError('Error updating editor stats:', error);
    }
}


function copyCode() {
    try {
        const codeEditor = document.getElementById('codeEditor');
        if (!codeEditor) {
            notifications.warning('Code editor not found');
            return;
        }
        
        const code = codeEditor.value;
        if (!code || code.trim() === '') {
            notifications.warning('No code to copy');
            return;
        }
        
        copyToClipboard(code, 'Code copied to clipboard!');
    } catch (error) {
        debugError('Error copying code:', error);
        notifications.error('Failed to copy code');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    try {
        
        const tabButtons = document.querySelectorAll('.tab-btn');
        if (tabButtons.length === 0) {
            debugWarn('No tab buttons found');
        } else {
            tabButtons.forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    const tabName = this.getAttribute('data-tab');
                    if (tabName) {
                        switchTab(tabName);
                    }
                });
            });
        }
        
        const languageSelect = document.getElementById('languageSelect');
        if (languageSelect) {
            languageSelect.addEventListener('change', updateLanguage);
            selectedLanguage = languageSelect.value;
           
            updateLanguage();
        } else {
            debugWarn('Language select element not found');
        }

        const analyzeBtn = document.getElementById('analyzeBtn');
        if (analyzeBtn) {
            if (!document.getElementById('exportBtn')) {
                const exportBtn = document.createElement('button');
                exportBtn.id = 'exportBtn';
                exportBtn.onclick = exportAnalysis;
                exportBtn.className = 'btn-export bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg transition shadow-md hover:shadow-lg flex items-center gap-2';
                exportBtn.innerHTML = `
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <span>Export</span>
                `;
                exportBtn.title = 'Export analysis results to JSON (Ctrl+E)';
                exportBtn.setAttribute('aria-label', 'Export analysis results');
                analyzeBtn.parentElement.insertBefore(exportBtn, analyzeBtn.nextSibling);
            }

            if (!document.getElementById('shareBtn') && typeof shareAnalysis === 'function') {
                const shareBtn = document.createElement('button');
                shareBtn.id = 'shareBtn';
                shareBtn.onclick = () => {
                    if (currentAnalysis) {
                        const code = document.getElementById('codeEditor')?.value || '';
                        shareAnalysis(currentAnalysis, code);
                    } else {
                        notifications.warning('No analysis to share');
                    }
                };
                shareBtn.className = 'btn-share bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg transition shadow-md hover:shadow-lg flex items-center gap-2';
                shareBtn.innerHTML = `
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path>
                    </svg>
                    <span>Share</span>
                `;
                shareBtn.title = 'Share analysis results';
                shareBtn.setAttribute('aria-label', 'Share analysis results');
                const exportBtn = document.getElementById('exportBtn');
                if (exportBtn) {
                    exportBtn.parentElement.insertBefore(shareBtn, exportBtn.nextSibling);
                }
            }
        }
        
        if (CONFIG.DEBUG) {
            window.switchTab = switchTab;
            window.exportAnalysis = exportAnalysis;
        }

        if (typeof initAccessibility === 'function') {
            initAccessibility();
        }

        if (typeof initDarkMode === 'function') {
            initDarkMode();
        }
        addKeyboardShortcutsInfo();
        
        const codeEditor = document.getElementById('codeEditor');
        if (codeEditor) {
            codeEditor.addEventListener('input', updateEditorStats);
            codeEditor.addEventListener('paste', () => setTimeout(updateEditorStats, 10));
            
            updateEditorStats();
        }

        debugLog('Application initialized successfully');
    } catch (error) {
        debugError('Error initializing application:', error);
        notifications.error('Failed to initialize application: ' + error.message);
    }
});


function addKeyboardShortcutsInfo() {

    const shortcuts = [
        { key: 'Ctrl/Cmd + S', action: 'Analyze code' },
        { key: 'Ctrl/Cmd + K', action: 'Clear editor' },
        { key: 'Ctrl/Cmd + L', action: 'Load sample' },
        { key: 'Ctrl/Cmd + E', action: 'Export results' },
        { key: 'Ctrl/Cmd + D', action: 'Toggle dark mode' },
        { key: 'Esc', action: 'Close notifications' }
    ];

    window.keyboardShortcuts = shortcuts;
}

/**
 * Sort leaks by criteria
 * @param {string} criteria - Sort criteria ('line', 'size', 'variable')
 */
function sortLeaks(criteria) {
    try {
        if (!currentAnalysis || !currentAnalysis.leaks) {
            return;
        }

        const sortedLeaks = [...currentAnalysis.leaks];
        
        switch(criteria) {
            case 'line':
                sortedLeaks.sort((a, b) => (a.line || 0) - (b.line || 0));
                break;
            case 'size':
                sortedLeaks.sort((a, b) => (b.size || 0) - (a.size || 0));
                break;
            case 'variable':
                sortedLeaks.sort((a, b) => (a.var || '').localeCompare(b.var || ''));
                break;
        }

        const sortedAnalysis = {
            ...currentAnalysis,
            leaks: sortedLeaks
        };
        
        updateLeaksTab(sortedAnalysis);
        
        debugLog('Leaks sorted by:', criteria);
    } catch (error) {
        debugError('Error sorting leaks:', error);
        notifications.error('Failed to sort leaks: ' + error.message);
    }
}

/**
 * Filter leaks by search term
 * @param {string} searchTerm - Search term
 */
function filterLeaks(searchTerm) {
    try {
        const leakItems = document.querySelectorAll('.leak-item');
        const term = searchTerm.toLowerCase().trim();
        
        leakItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            if (term === '' || text.includes(term)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
        
        debugLog('Leaks filtered by:', searchTerm);
    } catch (error) {
        debugError('Error filtering leaks:', error);
    }
}

/**
 * Copy leak details from element
 * @param {HTMLElement} button - Button element
 */
function copyLeakFromElement(button) {
    try {
        const leakItem = button.closest('.leak-item');
        if (!leakItem) {
            notifications.warning('Leak item not found');
            return;
        }

        const leakData = leakItem.getAttribute('data-leak');
        if (!leakData) {
            notifications.warning('Leak data not found');
            return;
        }

        const leak = JSON.parse(leakData);
        copyLeakDetails(leak);
    } catch (error) {
        debugError('Error copying leak from element:', error);
        notifications.error('Failed to copy leak details');
    }
}
