// ui.js - Enhanced UI with time-based row highlighting
// Path: /src/js/ui.js

export class UI {
    constructor() {
        this.currentMode = 'encounter';
        this.currentDate = null;
        this.toastTimeout = null;
    }

    showLoginScreen() {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
    }

    showMainApp(centerName) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';
        document.getElementById('centerDisplay').textContent = centerName;
        this.showToast('Welcome back!', 'success');
    }

    showLoading(message = 'Loading...') {
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <div class="loading">
                <div class="spinner-modern">
                    <div class="spinner-blade"></div>
                    <div class="spinner-blade"></div>
                    <div class="spinner-blade"></div>
                    <div class="spinner-blade"></div>
                    <div class="spinner-blade"></div>
                    <div class="spinner-blade"></div>
                    <div class="spinner-blade"></div>
                    <div class="spinner-blade"></div>
                </div>
                <div class="loading-text">${message}</div>
            </div>
        `;
    }

    showError(message) {
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <div class="empty-state-text">Error</div>
                <div class="empty-state-subtext">${message}</div>
            </div>
        `;
        this.showToast(message, 'error');
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = '';
        switch(type) {
            case 'success': icon = '<i class="fas fa-check-circle"></i>'; break;
            case 'error': icon = '<i class="fas fa-exclamation-circle"></i>'; break;
            case 'info': icon = '<i class="fas fa-info-circle"></i>'; break;
        }
        
        toast.innerHTML = `${icon} <span>${message}</span>`;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    showProgressOverlay(message = 'Updating data...') {
        const overlay = document.getElementById('progressOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.querySelector('.progress-text').textContent = message;
            // Reset progress bar
            const fill = document.querySelector('.progress-fill');
            if (fill) {
                fill.style.width = '0%';
            }
        }
    }

    hideProgressOverlay() {
        const overlay = document.getElementById('progressOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    updateProgressBar(progress) {
        const fill = document.querySelector('.progress-fill');
        if (fill) {
            fill.style.width = `${progress}%`;
        }
    }

    setActiveMode(mode) {
        this.currentMode = mode;
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
    }

    generateDateTabs(mode, data) {
        const tabsContainer = document.getElementById('dateTabs');
        
        if (mode === 'self') {
            tabsContainer.style.display = 'none';
            return;
        }
        
        tabsContainer.style.display = 'flex';
        tabsContainer.innerHTML = '';
        
        const dates = Object.keys(data[mode] || {}).sort();
        
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        
        dates.forEach(date => {
            const tab = document.createElement('button');
            tab.className = 'date-tab';
            
            const dateObj = new Date(date + 'T00:00:00');
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
            const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            tab.textContent = `${dayName}, ${monthDay}`;
            tab.dataset.date = date;
            
            if (date === today) {
                tab.classList.add('today');
            }
            
            if (!this.currentDate || date === today) {
                tab.classList.add('active');
                this.currentDate = date;
            }
            
            tab.onclick = () => {
                this.setActiveDate(date);
                window.selectDate(date);
            };
            
            tabsContainer.appendChild(tab);
        });
    }

    updateDateTabs(data) {
        const tabsContainer = document.getElementById('dateTabs');
        
        if (!tabsContainer || this.currentMode === 'self') {
            return;
        }
        
        const currentTabs = tabsContainer.querySelectorAll('.date-tab');
        const existingDates = Array.from(currentTabs).map(tab => tab.dataset.date);
        
        const newDates = Object.keys(data[this.currentMode] || {}).sort();
        const today = new Date().toISOString().split('T')[0];
        
        newDates.forEach(date => {
            if (!existingDates.includes(date)) {
                const tab = document.createElement('button');
                tab.className = 'date-tab';
                
                const dateObj = new Date(date + 'T00:00:00');
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                
                tab.textContent = `${dayName}, ${monthDay}`;
                tab.dataset.date = date;
                
                if (date === today) {
                    tab.classList.add('today');
                }
                
                tab.onclick = () => {
                    this.setActiveDate(date);
                    window.selectDate(date);
                };
                
                let inserted = false;
                for (let i = 0; i < currentTabs.length; i++) {
                    if (currentTabs[i].dataset.date > date) {
                        tabsContainer.insertBefore(tab, currentTabs[i]);
                        inserted = true;
                        break;
                    }
                }
                
                if (!inserted) {
                    tabsContainer.appendChild(tab);
                }
            }
        });
    }

    setActiveDate(date) {
        this.currentDate = date;
        document.querySelectorAll('.date-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.date === date);
        });
    }

    displayContent(mode, data) {
        const contentArea = document.getElementById('contentArea');
        
        if (!data || (Array.isArray(data) && data.length === 0)) {
            contentArea.innerHTML = this.getEmptyState(`No ${mode} data available for this date`);
            return;
        }
        
        switch(mode) {
            case 'encounter':
                this.displayEncounterContent(contentArea, data);
                break;
            case 'cc':
                this.displayCCContent(contentArea, data);
                break;
            case 'self':
                this.displaySelfBookingContent(contentArea, data);
                break;
        }
    }

    getDayName(dateString) {
        if (!dateString || !this.currentDate) return 'N/A';
        const date = new Date(this.currentDate + 'T00:00:00');
        return date.toLocaleDateString('en-US', { weekday: 'long' });
    }

    displayEncounterContent(container, timeGroups) {
        let html = '';
        const dayName = this.getDayName(this.currentDate);
        
        timeGroups.forEach(group => {
            html += `
                <div class="unit-container">
                    <div class="unit-box">
                        <div class="unit-header">
                            <div class="unit-info">
                                <span class="unit-title"><i class="fas fa-book"></i> ${group.unit}</span>
                                <span class="unit-time-badge">
                                    <i class="fas fa-clock"></i> ${group.time} - ${group.teacher}
                                </span>
                            </div>
                            <div class="unit-day">
                                <i class="fas fa-calendar-day"></i>
                                <span>${dayName}</span>
                            </div>
                        </div>
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Code</th>
                                        <th>Name</th>
                                        <th class="lesson-header">L1</th>
                                        <th class="lesson-header">L2</th>
                                        <th class="lesson-header">L3</th>
                                        <th class="workbook-header">W1</th>
                                        <th class="workbook-header">W2</th>
                                        <th class="workbook-header">W3</th>
                                        <th>Scores</th>
                                        <th>Result</th>
                                        <th>Profile</th>
                                        <th>Message</th>
                                        <th>Homework</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;
            
            group.students.forEach(student => {
                // Determine row class based on standby and time-based highlight
                let rowClass = '';
                if (student.isStandby) {
                    rowClass = 'standby-row';
                } else if (student.timeHighlight === 'danger') {
                    rowClass = 'time-danger-row';
                } else if (student.timeHighlight === 'warning') {
                    rowClass = 'time-warning-row';
                }
                
                html += `
                    <tr class="${rowClass}">
                        <td>${student.code}</td>
                        <td>${student.name}</td>
                        <td class="status-cell">
                            <span class="${this.getStatusClass(student.lessons[1])}">${this.formatStatusDisplay(student.lessons[1])}</span>
                        </td>
                        <td class="status-cell">
                            <span class="${this.getStatusClass(student.lessons[2])}">${this.formatStatusDisplay(student.lessons[2])}</span>
                        </td>
                        <td class="status-cell">
                            <span class="${this.getStatusClass(student.lessons[3])}">${this.formatStatusDisplay(student.lessons[3])}</span>
                        </td>
                        <td class="status-cell">
                            <span class="${this.getStatusClass(student.workbooks[1])}">${this.formatStatusDisplay(student.workbooks[1])}</span>
                        </td>
                        <td class="status-cell">
                            <span class="${this.getStatusClass(student.workbooks[2])}">${this.formatStatusDisplay(student.workbooks[2])}</span>
                        </td>
                        <td class="status-cell">
                            <span class="${this.getStatusClass(student.workbooks[3])}">${this.formatStatusDisplay(student.workbooks[3])}</span>
                        </td>
                        <td class="scores-cell">${this.formatScoresWithColors(student.scores)}</td>
                        <td><span class="${this.getResultClass(student.result)}">${student.result}</span></td>
                        <td><a href="${student.profileUrl}" target="_blank" class="profile-link">
                            <i class="fas fa-external-link-alt"></i> View
                        </a></td>
                        <td>${this.createCopyButton(student.message)}</td>
                        <td>${this.createCopyButton(student.homework)}</td>
                    </tr>
                `;
            });
            
            html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        });
        
        if (html === '') {
            container.innerHTML = this.getEmptyState('No encounter classes for this date');
        } else {
            container.innerHTML = html;
            this.attachCopyHandlers();
        }
    }

    displayCCContent(container, timeGroups) {
        let html = '';
        const dayName = this.getDayName(this.currentDate);
        
        timeGroups.forEach(group => {
            // Get unique teachers for this time slot
            const teachers = [...new Set(group.students.map(s => s.teacher))].join(', ');
            
            html += `
                <div class="unit-container">
                    <div class="unit-box">
                        <div class="unit-header">
                            <div class="unit-info">
                                <span class="unit-title"><i class="fas fa-book-open"></i> Complementary Classes</span>
                                <span class="unit-time-badge">
                                    <i class="fas fa-clock"></i> ${group.time} - ${teachers}
                                </span>
                            </div>
                            <div class="unit-day">
                                <i class="fas fa-calendar-day"></i>
                                <span>${dayName}</span>
                            </div>
                        </div>
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Code</th>
                                        <th>Name</th>
                                        <th>Type</th>
                                        <th>Profile</th>
                                        <th>Message</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;
            
            group.students.forEach(student => {
                html += `
                    <tr>
                        <td>${student.code}</td>
                        <td>${student.name}</td>
                        <td><span class="cc-type">${student.type}</span></td>
                        <td><a href="${student.profileUrl}" target="_blank" class="profile-link">
                            <i class="fas fa-external-link-alt"></i> View
                        </a></td>
                        <td>${this.createCopyButton(student.message)}</td>
                    </tr>
                `;
            });
            
            html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        });
        
        if (html === '') {
            container.innerHTML = this.getEmptyState('No CC classes for this date');
        } else {
            container.innerHTML = html;
            this.attachCopyHandlers();
        }
    }

    displaySelfBookingContent(container, students) {
        if (students.length === 0) {
            container.innerHTML = this.getEmptyState('No self-booking data available');
            return;
        }
        
        let html = '<div class="unit-box">';
        html += `
            <div class="unit-header">
                <span><i class="fas fa-calendar-check"></i> Self-Booking Status</span>
                <div class="unit-time">
                    <i class="fas fa-users"></i>
                    <span>${students.length} students</span>
                </div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Name</th>
                            <th>End Date</th>
                            <th>Self-Booking</th>
                            <th>Profile</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        students.forEach(student => {
            html += `
                <tr class="${student.isHighlighted ? 'highlighted-row' : ''}">
                    <td>${student.code}</td>
                    <td>${student.name}</td>
                    <td>${student.endDate}</td>
                    <td><span class="self-booking-yes">
                        <i class="fas fa-check"></i> Yes
                    </span></td>
                    <td><a href="https://world.wallstreetenglish.com/contract/view/${student.studentId}" target="_blank" class="profile-link">
                        <i class="fas fa-external-link-alt"></i> View Contract
                    </a></td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        </div>`;
        
        container.innerHTML = html;
    }

    createCopyButton(text) {
        if (!text || text === 'N/A') {
            return '<span style="color: #999;">-</span>';
        }
        
        const buttonId = 'copy-' + Math.random().toString(36).substr(2, 9);
        const cleanText = text.replace(/\n/g, '\\n').replace(/"/g, '&quot;');
        
        return `
            <button class="copy-btn" id="${buttonId}" data-text="${cleanText}" title="Click to copy">
                <i class="fas fa-copy"></i>
                Copy
            </button>
        `;
    }

    attachCopyHandlers() {
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const text = e.currentTarget.getAttribute('data-text').replace(/\\n/g, '\n');
                this.copyToClipboard(text, e.currentTarget);
            });
        });
    }

    async copyToClipboard(text, button) {
        try {
            await navigator.clipboard.writeText(text);
            
            // Change button state
            button.classList.add('copied');
            const originalHTML = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check"></i> Copied!';
            
            // Reset after 2 seconds
            setTimeout(() => {
                button.classList.remove('copied');
                button.innerHTML = originalHTML;
            }, 2000);
            
            this.showToast('Copied to clipboard!', 'success');
        } catch (err) {
            console.error('Failed to copy:', err);
            this.showToast('Failed to copy text', 'error');
        }
    }

    formatStatusDisplay(status) {
        if (status === 'C') {
            return '✔';
        }
        // Remove parentheses for better display
        if (status && status.includes('%')) {
            return status.replace(/[()]/g, '');
        }
        return status;
    }

    formatScoresWithColors(scores) {
        if (!scores || scores === 'N/A') return '<span style="color: #999;">N/A</span>';
        
        // Parse lesson and workbook scores
        const lMatch = scores.match(/L:([\d.-]+)/);
        const wMatch = scores.match(/W:([\d.-]+)/);
        
        let formattedHtml = '';
        
        if (lMatch) {
            const lScore = lMatch[1] === '-' ? null : parseFloat(lMatch[1]);
            if (lScore === null) {
                formattedHtml += '<span style="color: #999;">L:-</span>';
            } else if (lScore >= 7) {
                formattedHtml += `<span class="score-good">L:${lScore}</span>`;
            } else {
                formattedHtml += `<span class="score-bad">L:${lScore}</span>`;
            }
        }
        
        if (lMatch && wMatch) {
            formattedHtml += ' ';
        }
        
        if (wMatch) {
            const wScore = wMatch[1] === '-' ? null : parseFloat(wMatch[1]);
            if (wScore === null) {
                formattedHtml += '<span style="color: #999;">W:-</span>';
            } else if (wScore >= 7) {
                formattedHtml += `<span class="score-good">W:${wScore}</span>`;
            } else {
                formattedHtml += `<span class="score-bad">W:${wScore}</span>`;
            }
        }
        
        return formattedHtml || '<span style="color: #999;">N/A</span>';
    }

    getStatusClass(status) {
        if (status === 'C') {
            return 'status-complete';
        }
        
        if (status === '(0%)') {
            return 'status-not-started';
        }
        
        if (status && status.includes('%')) {
            const match = status.match(/\((\d+)%\)/);
            if (match) {
                const percent = parseInt(match[1]);
                if (percent >= 50) {
                    return 'status-progress-high';
                } else {
                    return 'status-progress-low';
                }
            }
        }
        
        return 'status-not-started';
    }

    getScoreClass(scores) {
        // This method is no longer needed as we handle colors inline
        return '';
    }

    getResultClass(result) {
        switch(result) {
            case 'Continue': return 'result-continue';
            case 'Repeat': return 'result-repeat';
            case 'No Show': return 'result-noshow';
            default: return 'result-pending';
        }
    }

    formatMessage(message) {
        if (!message || message === 'N/A') return '-';
        return message.replace(/\n/g, '<br>');
    }

    getEmptyState(message) {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-inbox"></i>
                </div>
                <div class="empty-state-text">No Data Available</div>
                <div class="empty-state-subtext">${message}</div>
            </div>
        `;
    }

    showProgressBar(progress) {
        this.updateProgressBar(progress);
        
        if (progress >= 100) {
            setTimeout(() => {
                this.hideProgressOverlay();
            }, 500);
        }
    }
}