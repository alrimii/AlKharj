// ui.js - Refactored with Tailwind CSS (Fixed Date Selection & 0% Display)
// Path: /src/js/ui.js

export class UI {
    constructor() {
        this.currentMode = 'encounter';
        this.currentDate = null;
        this.toastTimeout = null;
    }

    showLoginScreen() {
        const loginScreen = document.getElementById('loginScreen');
        const appContainer = document.getElementById('appContainer');
        if (loginScreen) {
            loginScreen.classList.remove('hidden');
            loginScreen.classList.add('flex');
        }
        if (appContainer) {
            appContainer.classList.add('hidden');
        }
    }

    showMainApp(centerName) {
        const loginScreen = document.getElementById('loginScreen');
        const appContainer = document.getElementById('appContainer');
        const centerDisplay = document.getElementById('centerDisplay');
        
        if (loginScreen) {
            loginScreen.classList.add('hidden');
            loginScreen.classList.remove('flex');
        }
        if (appContainer) {
            appContainer.classList.remove('hidden');
        }
        if (centerDisplay) {
            centerDisplay.textContent = centerName;
        }
        this.showToast('Welcome back!', 'success');
    }

    showLoading(message = 'Loading...') {
        const contentArea = document.getElementById('contentArea');
        if (!contentArea) return;
        
        contentArea.innerHTML = `
            <div class="flex items-center justify-center min-h-[400px]">
                <div class="text-center">
                    <div class="w-12 h-12 border-3 loading-spinner rounded-full mx-auto"></div>
                    <p class="mt-4 text-gray-600">${message}</p>
                </div>
            </div>`;
    }

    showError(message) {
        const contentArea = document.getElementById('contentArea');
        if (!contentArea) return;
        
        contentArea.innerHTML = `
            <div class="flex items-center justify-center min-h-[400px]">
                <div class="text-center max-w-md">
                    <div class="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-exclamation-triangle text-red-500 text-3xl"></i>
                    </div>
                    <h2 class="text-xl font-semibold text-gray-900 mb-2">Error</h2>
                    <p class="text-gray-600">${message}</p>
                </div>
            </div>`;
        this.showToast(message, 'error');
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle'
        };
        
        const colors = {
            success: 'border-green-500 bg-green-50',
            error: 'border-red-500 bg-red-50',
            info: 'border-blue-500 bg-blue-50',
            warning: 'border-orange-500 bg-orange-50'
        };
        
        const iconColors = {
            success: 'text-green-500',
            error: 'text-red-500',
            info: 'text-blue-500',
            warning: 'text-orange-500'
        };
        
        toast.className = `flex items-center gap-3 p-4 bg-white rounded-lg shadow-lg border-l-4 ${colors[type]} toast-enter min-w-[300px] max-w-md`;
        toast.innerHTML = `
            <i class="fas ${icons[type]} ${iconColors[type]} text-xl"></i>
            <span class="text-gray-700 font-medium">${message}</span>`;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.remove('toast-enter');
            toast.classList.add('toast-exit');
            toast.addEventListener('animationend', () => toast.remove());
        }, 3000);
    }
    
    toggleDateTabs(show) {
        const dateTabs = document.getElementById('dateTabs');
        if (dateTabs) {
            dateTabs.classList.toggle('hidden', !show);
        }
    }

    generateDateTabs(mode, data) {
        const tabsContainer = document.getElementById('dateTabs');
        if (!tabsContainer) return;
        
        let innerContainer = tabsContainer.querySelector('.container > div');
        if (!innerContainer) {
            const containerDiv = document.createElement('div');
            containerDiv.className = 'container mx-auto px-4 py-3';
            const innerDiv = document.createElement('div');
            innerDiv.className = 'flex gap-2 overflow-x-auto';
            containerDiv.appendChild(innerDiv);
            tabsContainer.appendChild(containerDiv);
            innerContainer = innerDiv;
        }
        
        tabsContainer.classList.remove('hidden');
        innerContainer.innerHTML = '';
        
        const dates = Object.keys(data[mode] || {}).sort();
        const today = new Date().toISOString().split('T')[0];
        
        dates.forEach(date => {
            innerContainer.appendChild(this.createDateTab(date, today));
        });

        const activeTab = this.currentDate && innerContainer.querySelector(`[data-date="${this.currentDate}"]`) 
            ? this.currentDate 
            : dates.includes(today) ? today : dates[0];
        
        if (activeTab) {
            this.setActiveDate(activeTab);
        }
    }
    
    createDateTab(date, today) {
        const tab = document.createElement('button');
        const dateObj = new Date(date + 'T00:00:00');
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        const isToday = date === today;
        
        // Start with default classes
        tab.className = 'date-tab px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-900';
        
        if (isToday) {
            tab.classList.add('ring-2', 'ring-green-500', 'ring-offset-2');
        }
        
        tab.innerHTML = `${dayName}, ${monthDay}`;
        if (isToday) {
            tab.innerHTML += ' <span class="today-badge ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Today</span>';
        }
        
        tab.dataset.date = date;
        
        tab.onclick = () => {
            if (window.wseApp) {
                window.wseApp.selectDate(date);
                // Call setActiveDate directly to ensure UI update
                this.setActiveDate(date);
            }
        };
        
        return tab;
    }

    setActiveDate(date) {
        this.currentDate = date;
        
        // Update all date tabs
        document.querySelectorAll('.date-tab').forEach(tab => {
            if (tab.dataset.date === date) {
                // This is the active tab - make it blue
                tab.classList.remove('bg-white', 'border-gray-300', 'text-gray-600', 'hover:bg-gray-50', 'hover:text-gray-900');
                tab.classList.add('bg-indigo-500', 'text-white', 'shadow-md', 'border-indigo-500', 'hover:bg-indigo-600');
                
                // Update Today badge color if it exists
                const todayBadge = tab.querySelector('.today-badge');
                if (todayBadge) {
                    todayBadge.classList.remove('bg-green-100', 'text-green-700');
                    todayBadge.classList.add('bg-white', 'bg-opacity-20', 'text-white');
                }
            } else {
                // This is not active - reset to default
                tab.classList.remove('bg-indigo-500', 'text-white', 'shadow-md', 'border-indigo-500', 'hover:bg-indigo-600');
                tab.classList.add('bg-white', 'border-gray-300', 'text-gray-600', 'hover:bg-gray-50', 'hover:text-gray-900');
                
                // Reset Today badge color if it exists
                const todayBadge = tab.querySelector('.today-badge');
                if (todayBadge) {
                    todayBadge.classList.remove('bg-white', 'bg-opacity-20', 'text-white');
                    todayBadge.classList.add('bg-green-100', 'text-green-700');
                }
            }
        });
    }

    setActiveMode(mode) {
        this.currentMode = mode;
    }

    displayContent(mode, data) {
        const contentArea = document.getElementById('contentArea');
        if (!contentArea) return;
        
        if (!data || (Array.isArray(data) && data.length === 0)) {
            contentArea.innerHTML = this.getEmptyStateHTML(`No ${mode} data available for this date`);
            return;
        }
        
        if (mode === 'encounter') {
            this.displayEncounterContent(contentArea, data);
        } else if (mode === 'cc') {
            this.displayCCContent(contentArea, data);
        }
    }

    getDayName(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString + 'T00:00:00');
        return date.toLocaleDateString('en-US', { weekday: 'long' });
    }
    
    displayGlobalSearchResults(results) {
        const contentArea = document.getElementById('contentArea');
        if (!contentArea) return;
        
        if (Object.keys(results).length === 0) {
            contentArea.innerHTML = this.getEmptyStateHTML('No students found matching your search.');
            return;
        }

        let html = '<div class="space-y-4">';
        for (const studentId in results) {
            const student = results[studentId];
            html += this.createSearchResultCardHTML(student);
        }
        html += '</div>';
        contentArea.innerHTML = html;
    }

    displayEncounterContent(container, timeGroups) {
        if (!container) return;
        
        const dayName = this.getDayName(this.currentDate);
        let html = '<div class="space-y-6">';
        html += timeGroups.map(group => this.createEncounterGroupHTML(group, dayName)).join('');
        html += '</div>';
        container.innerHTML = html || this.getEmptyStateHTML('No encounter classes for this date');
        this.attachCopyHandlers();
    }

    displayCCContent(container, timeGroups) {
        if (!container) return;
        
        const dayName = this.getDayName(this.currentDate);
        let html = '<div class="space-y-6">';
        html += timeGroups.map(group => this.createCCGroupHTML(group, dayName)).join('');
        html += '</div>';
        container.innerHTML = html || this.getEmptyStateHTML('No CC classes for this date');
        this.attachCopyHandlers();
    }

    createEncounterGroupHTML(group, dayName) {
        return `
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div class="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-4">
                    <div class="flex flex-wrap items-center justify-between gap-4">
                        <div class="flex flex-wrap items-center gap-4">
                            <span class="flex items-center gap-2 text-lg font-semibold">
                                <i class="fas fa-book"></i>
                                ${group.unit}
                            </span>
                            <span class="px-3 py-1 bg-white/20 rounded-full text-sm">
                                <i class="fas fa-clock mr-1"></i>
                                ${group.time} - ${group.teacher}
                            </span>
                        </div>
                        <span class="px-3 py-1 bg-white/10 rounded-full text-sm">
                            <i class="fas fa-calendar-day mr-1"></i>
                            ${dayName}
                        </span>
                    </div>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="bg-gray-50 border-b border-gray-200">
                                <th class="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Code</th>
                                <th class="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[100px]">Name</th>
                                <th class="px-2 py-3 text-center text-xs font-semibold text-gray-600 uppercase">L1</th>
                                <th class="px-2 py-3 text-center text-xs font-semibold text-gray-600 uppercase">L2</th>
                                <th class="px-2 py-3 text-center text-xs font-semibold text-gray-600 uppercase">L3</th>
                                <th class="px-2 py-3 text-center text-xs font-semibold text-gray-600 uppercase">W1</th>
                                <th class="px-2 py-3 text-center text-xs font-semibold text-gray-600 uppercase">W2</th>
                                <th class="px-2 py-3 text-center text-xs font-semibold text-gray-600 uppercase">W3</th>
                                <th class="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase min-w-[90px]">Overall</th>
                                <th class="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Result</th>
                                <th class="px-2 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Profile</th>
                                <th class="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Message</th>
                                <th class="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Homework</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            ${group.students.map(student => this.createEncounterStudentRowHTML(student)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
    }
    
    createEncounterStudentRowHTML(student) {
        let rowClasses = 'hover:bg-gray-50 transition-colors';
        if (student.isStandby) rowClasses += ' opacity-70 bg-gray-50';
        if (student.timeHighlight === 'warning') rowClasses += ' bg-orange-50 border-l-4 border-orange-400';
        if (student.timeHighlight === 'danger') rowClasses += ' bg-red-50 border-l-4 border-red-400';

        return `
            <tr class="${rowClasses}">
                <td class="px-3 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">${student.code}</td>
                <td class="px-3 py-2">
                    <button class="text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline" 
                            onclick="window.showStudentProfile('${student.userId}')">
                        ${student.name}
                    </button>
                </td>
                <td class="px-2 py-2 text-center">${this.createModernStatusBadge(student.lessons[1], 'L')}</td>
                <td class="px-2 py-2 text-center">${this.createModernStatusBadge(student.lessons[2], 'L')}</td>
                <td class="px-2 py-2 text-center">${this.createModernStatusBadge(student.lessons[3], 'L')}</td>
                <td class="px-2 py-2 text-center">${this.createModernStatusBadge(student.workbooks[1], 'W')}</td>
                <td class="px-2 py-2 text-center">${this.createModernStatusBadge(student.workbooks[2], 'W')}</td>
                <td class="px-2 py-2 text-center">${this.createModernStatusBadge(student.workbooks[3], 'W')}</td>
                <td class="px-3 py-2 text-center whitespace-nowrap">${this.formatScoresInline(student.scores)}</td>
                <td class="px-3 py-2 text-center">${this.createResultBadge(student.result)}</td>
                <td class="px-2 py-2 text-center">
                    <a href="${student.profileUrl}" target="_blank" rel="noopener noreferrer" 
                       class="text-indigo-600 hover:text-indigo-800 transition-colors">
                        <i class="fas fa-external-link-alt"></i>
                    </a>
                </td>
                <td class="px-3 py-2 text-center">${this.createCopyButton(student.message)}</td>
                <td class="px-3 py-2 text-center">${this.createCopyButton(student.homework)}</td>
            </tr>`;
    }

    createCCGroupHTML(group, dayName) {
        const teachers = [...new Set(group.students.map(s => s.teacher))].join(', ');
        return `
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div class="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white p-4">
                    <div class="flex flex-wrap items-center justify-between gap-4">
                        <div class="flex flex-wrap items-center gap-4">
                            <span class="flex items-center gap-2 text-lg font-semibold">
                                <i class="fas fa-book-open"></i>
                                Complementary Classes
                            </span>
                            <span class="px-3 py-1 bg-white/20 rounded-full text-sm">
                                <i class="fas fa-clock mr-1"></i>
                                ${group.time} - ${teachers}
                            </span>
                        </div>
                        <span class="px-3 py-1 bg-white/10 rounded-full text-sm">
                            <i class="fas fa-calendar-day mr-1"></i>
                            ${dayName}
                        </span>
                    </div>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead>
                            <tr class="bg-gray-50 border-b border-gray-200">
                                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Code</th>
                                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Profile</th>
                                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Message</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            ${group.students.map(student => `
                                <tr class="hover:bg-gray-50 transition-colors">
                                    <td class="px-4 py-3 text-sm font-medium text-gray-900">${student.code}</td>
                                    <td class="px-4 py-3 text-sm text-gray-700">${student.name}</td>
                                    <td class="px-4 py-3 text-center">
                                        <span class="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                            ${student.type}
                                        </span>
                                    </td>
                                    <td class="px-4 py-3 text-center">
                                        <a href="${student.profileUrl}" target="_blank" rel="noopener noreferrer"
                                           class="text-indigo-600 hover:text-indigo-800">
                                            <i class="fas fa-external-link-alt"></i>
                                        </a>
                                    </td>
                                    <td class="px-4 py-3 text-center">${this.createCopyButton(student.message)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
    }

    createSearchResultCardHTML(student) {
        return `
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div class="bg-gradient-to-r from-gray-700 to-gray-800 text-white p-4">
                    <div class="flex items-center justify-between">
                        <span class="flex items-center gap-3 text-lg font-semibold">
                            <i class="fas fa-user"></i>
                            ${student.name} (${student.code})
                        </span>
                        <a href="https://world.wallstreetenglish.com/profile/${student.userId}/gradeBook" 
                           target="_blank" 
                           rel="noopener noreferrer"
                           class="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                            <i class="fas fa-external-link-alt mr-2"></i>
                            View Profile
                        </a>
                    </div>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead>
                            <tr class="bg-gray-50 border-b border-gray-200">
                                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Time</th>
                                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Type</th>
                                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Details</th>
                                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Teacher</th>
                                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Result</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            ${student.appearances.map(app => `
                                <tr class="hover:bg-gray-50">
                                    <td class="px-4 py-3 text-sm text-gray-700">${app.date}</td>
                                    <td class="px-4 py-3 text-sm text-gray-700">${app.time}</td>
                                    <td class="px-4 py-3 text-center">
                                        <span class="px-2 py-1 ${app.mode === 'Encounter' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'} text-xs font-medium rounded">
                                            ${app.mode}
                                        </span>
                                    </td>
                                    <td class="px-4 py-3 text-sm text-gray-700">${app.details}</td>
                                    <td class="px-4 py-3 text-sm text-gray-700">${app.teacher}</td>
                                    <td class="px-4 py-3 text-center">${this.createResultBadge(app.result)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
    }

    createModernStatusBadge(status, type) {
        if (status === 'C') {
            // Complete - Modern checkmark design
            return `
                <div class="relative inline-flex items-center justify-center w-9 h-9">
                    <div class="absolute inset-0 bg-green-500 rounded-lg opacity-10"></div>
                    <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                </div>`;
        } else if (status === '(0%)') {
            // Not started - Show 0% with gray background
            return `
                <div class="relative inline-flex items-center justify-center w-9 h-9">
                    <div class="absolute inset-0 bg-gray-100 rounded-lg border border-gray-300"></div>
                    <span class="relative text-xs font-bold text-gray-500">0%</span>
                </div>`;
        } else if (status && status.includes('%')) {
            // In progress - Progress ring with percentage
            const percent = parseInt(status.match(/\((\d+)%\)/)?.[1] || 0);
            const circumference = 2 * Math.PI * 10;
            const strokeDashoffset = circumference - (percent / 100) * circumference;
            
            let color = 'text-red-500';
            let bgColor = 'bg-red-50';
            if (percent >= 75) {
                color = 'text-green-500';
                bgColor = 'bg-green-50';
            } else if (percent >= 50) {
                color = 'text-yellow-500';
                bgColor = 'bg-yellow-50';
            } else if (percent >= 25) {
                color = 'text-orange-500';
                bgColor = 'bg-orange-50';
            }
            
            return `
                <div class="relative inline-flex items-center justify-center w-9 h-9">
                    <div class="absolute inset-0 ${bgColor} rounded-lg opacity-50"></div>
                    <svg class="w-8 h-8 transform -rotate-90">
                        <circle cx="16" cy="16" r="10" stroke="currentColor" stroke-width="2" fill="none" class="text-gray-200"></circle>
                        <circle cx="16" cy="16" r="10" stroke="currentColor" stroke-width="2" fill="none" 
                                class="${color}" 
                                stroke-dasharray="${circumference}" 
                                stroke-dashoffset="${strokeDashoffset}"
                                stroke-linecap="round"></circle>
                    </svg>
                    <span class="absolute text-xs font-semibold text-gray-700">${percent}</span>
                </div>`;
        }
        return '<span class="text-gray-400 text-xs">-</span>';
    }

    createResultBadge(result) {
        const badges = {
            'Continue': 'bg-gradient-to-r from-green-400 to-green-500 text-white shadow-sm',
            'Repeat': 'bg-gradient-to-r from-red-400 to-red-500 text-white shadow-sm',
            'No Show': 'bg-gray-100 text-gray-600 border border-gray-300',
            'P': 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-sm'
        };
        const classes = badges[result] || badges['P'];
        return `<span class="inline-block px-3 py-1 ${classes} text-xs font-semibold rounded-full">${result}</span>`;
    }

    createCopyButton(text) {
        if (!text || text === 'N/A') {
            return '<span class="text-gray-400 text-xs">-</span>';
        }
        const cleanText = text.replace(/"/g, '&quot;').replace(/\n/g, '\\n');
        return `
            <button class="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all copy-btn" 
                    data-text="${cleanText}" 
                    title="Copy">
                <i class="fas fa-copy"></i>
            </button>`;
    }

    formatScoresInline(scores) {
        if (!scores || scores === 'N/A') {
            return '<span class="text-gray-400 text-xs">N/A</span>';
        }
        
        const [lPart, wPart] = scores.split(' ');
        const formatPart = (part) => {
            if (!part) return '';
            const [label, valueStr] = part.split(':');
            if (valueStr === '-') {
                return `<span class="text-gray-400">${label}:-</span>`;
            }
            const value = parseFloat(valueStr);
            const color = value >= 7 ? 'text-green-600' : 'text-red-600';
            return `<span class="${color} font-semibold">${label}:${value}</span>`;
        };
        
        return `<div class="flex items-center gap-2 justify-center">${formatPart(lPart)} ${formatPart(wPart)}</div>`;
    }

    formatScoresWithColors(scores) {
        if (!scores || scores === 'N/A') {
            return '<span class="text-gray-400 text-sm">N/A</span>';
        }
        
        const [lPart, wPart] = scores.split(' ');
        const formatPart = (part, goodThreshold) => {
            if (!part) return '';
            const [label, valueStr] = part.split(':');
            if (valueStr === '-') {
                return `<span class="text-gray-400 text-sm">${label}:-</span>`;
            }
            const value = parseFloat(valueStr);
            const color = value >= goodThreshold ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold';
            return `<span class="${color} text-sm">${label}:${value}</span>`;
        };
        
        return `
            <div class="flex items-center gap-2 justify-center">
                ${formatPart(lPart, 7)}
                ${formatPart(wPart, 7)}
            </div>`;
    }

    attachCopyHandlers() {
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const text = e.currentTarget.dataset.text.replace(/\\n/g, '\n');
                await this.copyToClipboard(text, e.currentTarget);
            });
        });
    }

    async copyToClipboard(text, button) {
        try {
            await navigator.clipboard.writeText(text);
            const originalHTML = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check text-green-600"></i>';
            button.classList.add('bg-green-50');
            this.showToast('Copied to clipboard!', 'success');
            
            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.classList.remove('bg-green-50');
            }, 2000);
        } catch (err) {
            this.showToast('Failed to copy text', 'error');
        }
    }

    showStudentProfileModal(profileData) {
        this.closeStudentProfileModal();
        
        const historyHTML = profileData.history && profileData.history.length > 0
            ? `
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="sticky top-0 bg-gray-50 z-10">
                            <tr class="border-b border-gray-200">
                                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Unit</th>
                                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Teacher</th>
                                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Score</th>
                                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Overall</th>
                                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Result</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            ${profileData.history.map(item => `
                                <tr class="hover:bg-gray-50">
                                    <td class="px-4 py-3 text-sm text-gray-700">${item.unit}</td>
                                    <td class="px-4 py-3 text-sm text-gray-700">${item.teacher}</td>
                                    <td class="px-4 py-3 text-center text-sm text-gray-700">${item.score}</td>
                                    <td class="px-4 py-3 text-center">${this.formatScoresWithColors(item.overall)}</td>
                                    <td class="px-4 py-3 text-center">${this.createResultBadge(item.result)}</td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>`
            : '<div class="text-center py-8 text-gray-500">No encounter history found.</div>';
        
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4';
        modal.id = 'studentProfileModalOverlay';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-slide-up">
                <div class="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-6">
                    <div class="flex items-center justify-between">
                        <h2 class="text-2xl font-bold">${profileData.name}</h2>
                        <button id="modalCloseBtn" 
                                class="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                <div class="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Encounter History</h3>
                    ${historyHTML}
                </div>
            </div>`;
        
        document.body.appendChild(modal);
        modal.querySelector('#modalCloseBtn').onclick = () => this.closeStudentProfileModal();
        modal.onclick = (e) => {
            if (e.target === modal) this.closeStudentProfileModal();
        };
    }

    closeStudentProfileModal() {
        const modal = document.getElementById('studentProfileModalOverlay');
        if (modal) {
            modal.classList.add('animate-fade-out');
            setTimeout(() => modal.remove(), 200);
        }
    }

    getEmptyStateHTML(message) {
        return `
            <div class="flex items-center justify-center min-h-[400px]">
                <div class="text-center max-w-md">
                    <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-inbox text-gray-400 text-3xl"></i>
                    </div>
                    <h2 class="text-xl font-semibold text-gray-900 mb-2">No Data Available</h2>
                    <p class="text-gray-600">${message}</p>
                </div>
            </div>`;
    }

    updateDateTabs() {
        if (window.wseApp && window.wseApp.state) {
            this.generateDateTabs(this.currentMode, window.wseApp.state.data || {});
        }
    }
}