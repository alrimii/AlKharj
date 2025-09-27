// ui.js - Enhanced with Professional Color Scheme, Social Club Features, Overall Column, and Lesson/Workbook Status in Profile
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
                    <p class="mt-4 text-slate-600">${message}</p>
                </div>
            </div>`;
    }

    showError(message) {
        const contentArea = document.getElementById('contentArea');
        if (!contentArea) return;
        
        contentArea.innerHTML = `
            <div class="flex items-center justify-center min-h-[400px]">
                <div class="text-center max-w-md">
                    <div class="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-exclamation-triangle text-red-500 text-3xl"></i>
                    </div>
                    <h2 class="text-xl font-semibold text-slate-800 mb-2">Error</h2>
                    <p class="text-slate-600">${message}</p>
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
            success: 'border-emerald-500 bg-emerald-50',
            error: 'border-red-500 bg-red-50',
            info: 'border-sky-500 bg-sky-50',
            warning: 'border-amber-500 bg-amber-50'
        };
        
        const iconColors = {
            success: 'text-emerald-600',
            error: 'text-red-600',
            info: 'text-sky-600',
            warning: 'text-amber-600'
        };
        
        toast.className = `flex items-center gap-3 p-4 bg-white rounded-lg shadow-lg border-l-4 ${colors[type]} toast-enter min-w-[300px] max-w-md`;
        toast.innerHTML = `
            <i class="fas ${icons[type]} ${iconColors[type]} text-xl"></i>
            <span class="text-slate-700 font-medium">${message}</span>`;
        
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
        // Parse date using UTC to avoid timezone issues
        const [year, month, day] = date.split('-').map(Number);
        const dateObj = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
        
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        const dayName = days[dateObj.getUTCDay()];
        const monthName = months[dateObj.getUTCMonth()];
        const dayNum = dateObj.getUTCDate();
        
        const isToday = date === today;
        
        // Start with default classes
        tab.className = 'date-tab px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900';
        
        if (isToday) {
            tab.classList.add('ring-2', 'ring-emerald-400', 'ring-offset-2');
        }
        
        tab.innerHTML = `${dayName}, ${monthName} ${dayNum}`;
        if (isToday) {
            tab.innerHTML += ' <span class="today-badge ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">Today</span>';
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
                // This is the active tab
                tab.classList.remove('bg-white', 'border-slate-200', 'text-slate-600', 'hover:bg-slate-50', 'hover:text-slate-900');
                tab.classList.add('bg-slate-700', 'text-white', 'shadow-md', 'border-slate-700', 'hover:bg-slate-800');
                
                // Update Today badge color if it exists
                const todayBadge = tab.querySelector('.today-badge');
                if (todayBadge) {
                    todayBadge.classList.remove('bg-emerald-100', 'text-emerald-700');
                    todayBadge.classList.add('bg-white', 'bg-opacity-20', 'text-white');
                }
            } else {
                // This is not active - reset to default
                tab.classList.remove('bg-slate-700', 'text-white', 'shadow-md', 'border-slate-700', 'hover:bg-slate-800');
                tab.classList.add('bg-white', 'border-slate-200', 'text-slate-600', 'hover:bg-slate-50', 'hover:text-slate-900');
                
                // Reset Today badge color if it exists
                const todayBadge = tab.querySelector('.today-badge');
                if (todayBadge) {
                    todayBadge.classList.remove('bg-white', 'bg-opacity-20', 'text-white');
                    todayBadge.classList.add('bg-emerald-100', 'text-emerald-700');
                }
            }
        });
    }

    setActiveMode(mode) {
        this.currentMode = mode;
    }

    displayContent(mode, data, currentDate = null) {
        const contentArea = document.getElementById('contentArea');
        if (!contentArea) return;
        
        // Use passed currentDate or fallback to this.currentDate
        const dateToUse = currentDate || this.currentDate;
        
        if (!data || (Array.isArray(data) && data.length === 0)) {
            contentArea.innerHTML = this.getEmptyStateHTML(`No ${mode} data available for this date`);
            return;
        }
        
        if (mode === 'encounter') {
            this.displayEncounterContent(contentArea, data, dateToUse);
        } else if (mode === 'cc') {
            this.displayCCContent(contentArea, data, dateToUse);
        }
    }

    getDayName(dateString) {
        if (!dateString) return 'N/A';
        
        // Parse date components directly to avoid timezone issues
        const [year, month, day] = dateString.split('-').map(Number);
        
        // Create date using UTC to ensure consistent day
        const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
        
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        // Use getUTCDay to get the correct day
        return days[date.getUTCDay()];
    }
    
    getDayLabel(dateString) {
        if (!dateString) return '';
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const compareDate = new Date(dateString + 'T00:00:00');
        compareDate.setHours(0, 0, 0, 0);
        
        if (compareDate.getTime() === today.getTime()) {
            return '<span class="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded">Today</span>';
        } else if (compareDate.getTime() === tomorrow.getTime()) {
            return '<span class="ml-2 px-2 py-0.5 bg-teal-100 text-teal-700 text-xs font-semibold rounded">Tomorrow</span>';
        }
        return '';
    }

    // Helper function to check if student has incomplete homework
    checkHomeworkStatus(appearance) {
        // For encounter appearances, check if there's incomplete homework
        if (appearance.mode === 'Encounter' && appearance.lessonStatus && appearance.workbookStatus) {
            const incompleteLessons = [];
            const incompleteWorkbooks = [];

            // Check lessons
            for (let i = 1; i <= 3; i++) {
                if (appearance.lessonStatus[i] !== 'C') {
                    incompleteLessons.push(i);
                }
            }

            // Check workbooks
            for (let i = 1; i <= 3; i++) {
                if (appearance.workbookStatus[i] !== 'C') {
                    incompleteWorkbooks.push(i);
                }
            }

            return {
                hasIncompleteLessons: incompleteLessons.length > 0,
                hasIncompleteWorkbooks: incompleteWorkbooks.length > 0,
                incompleteLessons,
                incompleteWorkbooks
            };
        }
        
        return {
            hasIncompleteLessons: false,
            hasIncompleteWorkbooks: false,
            incompleteLessons: [],
            incompleteWorkbooks: []
        };
    }
    
    // UPDATED: Enhanced to show lesson/workbook status in search results
    displayGlobalSearchResults(results) {
        const contentArea = document.getElementById('contentArea');
        if (!contentArea) return;
        
        if (Object.keys(results).length === 0) {
            contentArea.innerHTML = this.getEmptyStateHTML('No students found matching your search.');
            return;
        }

        // Separate encounters and CC classes
        let encounterHTML = '';
        let ccHTML = '';
        
        for (const studentId in results) {
            const student = results[studentId];
            const encounterApps = student.appearances.filter(app => app.mode === 'Encounter');
            const ccApps = student.appearances.filter(app => app.mode === 'CC');
            
            if (encounterApps.length > 0) {
                encounterHTML += this.createSearchResultCardHTML(student, encounterApps, 'Encounter');
            }
            
            if (ccApps.length > 0) {
                ccHTML += this.createSearchResultCardHTML(student, ccApps, 'CC');
            }
        }
        
        let html = '<div class="space-y-6">';
        
        if (encounterHTML) {
            html += `
                <div>
                    <h2 class="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                        <i class="fas fa-users text-slate-600"></i>
                        Encounter Classes
                    </h2>
                    <div class="space-y-4">${encounterHTML}</div>
                </div>`;
        }
        
        if (ccHTML) {
            html += `
                <div>
                    <h2 class="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                        <i class="fas fa-book-open text-teal-600"></i>
                        CC Classes & Social Club
                    </h2>
                    <div class="space-y-4">${ccHTML}</div>
                </div>`;
        }
        
        html += '</div>';
        contentArea.innerHTML = html;
    }

    displayEncounterContent(container, timeGroups, selectedDate = null) {
        if (!container) return;
        
        // FIXED: Use the passed selectedDate parameter directly
        const dayName = selectedDate ? this.getDayName(selectedDate) : 'N/A';
        
        let html = '<div class="space-y-6">';
        html += timeGroups.map(group => this.createEncounterGroupHTML(group, dayName)).join('');
        html += '</div>';
        container.innerHTML = html || this.getEmptyStateHTML('No encounter classes for this date');
        this.attachCopyHandlers();
    }

    displayCCContent(container, timeGroups, selectedDate = null) {
        if (!container) return;
        
        // FIXED: Use the passed selectedDate parameter directly
        const dayName = selectedDate ? this.getDayName(selectedDate) : 'N/A';
        
        let html = '<div class="space-y-6">';
        html += timeGroups.map(group => this.createCCGroupHTML(group, dayName)).join('');
        html += '</div>';
        container.innerHTML = html || this.getEmptyStateHTML('No CC classes for this date');
        this.attachCopyHandlers();
    }

    createEncounterGroupHTML(group, dayName) {
        return `
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div class="bg-slate-700 text-white p-4">
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
                            <tr class="bg-slate-50 border-b border-slate-200">
                                <th class="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Code</th>
                                <th class="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider min-w-[100px]">Name</th>
                                <th class="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase">L1</th>
                                <th class="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase">L2</th>
                                <th class="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase">L3</th>
                                <th class="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase">W1</th>
                                <th class="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase">W2</th>
                                <th class="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase">W3</th>
                                <th class="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase min-w-[90px]">Overall</th>
                                <th class="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Result</th>
                                <th class="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Profile</th>
                                <th class="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Message</th>
                                <th class="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Homework</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${group.students.map(student => this.createEncounterStudentRowHTML(student, group.teacher, group.unitNumber)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
    }
    
    createEncounterStudentRowHTML(student, teacher, unitNumber) {
        let rowClasses = 'hover:bg-slate-50 transition-colors';
        if (student.isStandby) rowClasses += ' opacity-70 bg-slate-50';
        if (student.timeHighlight === 'warning') rowClasses += ' bg-amber-50 border-l-4 border-amber-400';
        if (student.timeHighlight === 'danger') rowClasses += ' bg-red-50 border-l-4 border-red-400';

        return `
            <tr class="${rowClasses}">
                <td class="px-3 py-2 text-sm font-medium text-slate-900 whitespace-nowrap">${student.code}</td>
                                    <td class="px-3 py-2">
                    <button class="text-sm font-medium text-slate-600 hover:text-slate-800 hover:underline" 
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
                <td class="px-3 py-2 text-center">${this.createClickableResultBadge(student.result, student.feedback, student.userId, student.unitNumber, teacher, student.name)}</td>
                <td class="px-2 py-2 text-center">
                    <a href="${student.profileUrl}" target="_blank" rel="noopener noreferrer" 
                       class="text-slate-600 hover:text-slate-800 transition-colors">
                        <i class="fas fa-external-link-alt"></i>
                    </a>
                </td>
                <td class="px-3 py-2 text-center">${this.createCopyButton(student.message)}</td>
                <td class="px-3 py-2 text-center">${this.createCopyButton(student.homework)}</td>
            </tr>`;
    }

    createCCGroupHTML(group, dayName) {
        // Check if this group contains any Social Club students
        const hasSocialClub = group.students.some(s => s.isSocialClub);
        const hasRegularCC = group.students.some(s => !s.isSocialClub);
        
        // Determine header color and title based on content
        let headerClass = 'bg-teal-700';
        let iconClass = 'fa-book-open';
        let title = 'Complementary Classes';
        
        if (hasSocialClub && !hasRegularCC) {
            // Only Social Club
            headerClass = 'bg-gradient-to-r from-amber-600 to-amber-700';
            iconClass = 'fa-users';
            title = 'Social Club';
        } else if (hasSocialClub && hasRegularCC) {
            // Mixed
            title = 'CC & Social Club';
            headerClass = 'bg-gradient-to-r from-teal-700 to-amber-600';
        }
        
        const teachers = [...new Set(group.students.map(s => s.teacher))].join(', ');
        
        return `
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div class="${headerClass} text-white p-4">
                    <div class="flex flex-wrap items-center justify-between gap-4">
                        <div class="flex flex-wrap items-center gap-4">
                            <span class="flex items-center gap-2 text-lg font-semibold">
                                <i class="fas ${iconClass}"></i>
                                ${title}
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
                            <tr class="bg-slate-50 border-b border-slate-200">
                                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Code</th>
                                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Name</th>
                                <th class="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
                                <th class="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Profile</th>
                                <th class="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Message</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${group.students.map(student => `
                                <tr class="hover:bg-slate-50 transition-colors">
                                    <td class="px-4 py-3 text-sm font-medium text-slate-900">${student.code}</td>
                                    <td class="px-4 py-3 text-sm text-slate-700">${student.name}</td>
                                    <td class="px-4 py-3 text-center">
                                        <span class="px-2 py-1 ${student.isSocialClub ? 
                                            'bg-amber-100 text-amber-800 font-semibold' : 
                                            'bg-teal-100 text-teal-700'} text-xs font-medium rounded">
                                            ${student.type}
                                        </span>
                                    </td>
                                    <td class="px-4 py-3 text-center">
                                        <a href="${student.profileUrl}" target="_blank" rel="noopener noreferrer"
                                           class="text-slate-600 hover:text-slate-800">
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

    // UPDATED: Enhanced to show lesson/workbook status in search results
    createSearchResultCardHTML(student, appearances, type) {
        const bgColor = type === 'Encounter' ? 'bg-slate-700' : 'bg-teal-700';
        const icon = type === 'Encounter' ? 'fa-users' : 'fa-book-open';
        
        return `
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div class="${bgColor} text-white p-4">
                    <div class="flex items-center justify-between">
                        <span class="flex items-center gap-3 text-lg font-semibold">
                            <i class="fas ${icon}"></i>
                            ${student.name} (${student.code})
                        </span>
                        <div class="flex gap-2">
                            ${type === 'Encounter' ? `
                                <button onclick="window.showStudentProfile('${student.userId}')"
                                        class="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                                    <i class="fas fa-info-circle mr-2"></i>
                                    View Details
                                </button>` : ''}
                            <a href="https://world.wallstreetenglish.com/profile/${student.userId}/gradeBook" 
                               target="_blank" 
                               rel="noopener noreferrer"
                               class="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors flex items-center">
                                <i class="fas fa-external-link-alt mr-2"></i>
                                Open Profile
                            </a>
                        </div>
                    </div>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead>
                            <tr class="bg-slate-50 border-b border-slate-200">
                                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Day</th>
                                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Time</th>
                                ${type === 'Encounter' ? '<th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Unit</th>' : '<th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>'}
                                ${type === 'Encounter' ? `
                                    <th class="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase">L1</th>
                                    <th class="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase">L2</th>
                                    <th class="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase">L3</th>
                                    <th class="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase">W1</th>
                                    <th class="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase">W2</th>
                                    <th class="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase">W3</th>
                                ` : ''}
                                ${type === 'Encounter' ? '<th class="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Overall</th>' : ''}
                                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Teacher</th>
                                ${type === 'Encounter' ? '<th class="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Result</th>' : ''}
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${appearances.map(app => {
                                const dayName = app.date ? this.getDayName(app.date) : 'N/A';
                                const dayLabel = this.getDayLabel(app.date);
                                const unitNumber = app.details ? app.details.replace('Unit ', '') : '';
                                const isSocialClub = app.details === 'Social Club';
                                
                                // Check homework status for row highlighting
                                const homeworkStatus = this.checkHomeworkStatus(app);
                                let rowClass = 'hover:bg-slate-50';
                                
                                if (type === 'Encounter') {
                                    if (homeworkStatus.hasIncompleteLessons) {
                                        // Red background if lessons are incomplete
                                        rowClass = 'bg-red-50 border-l-4 border-red-400';
                                    } else if (homeworkStatus.hasIncompleteWorkbooks) {
                                        // Orange background if only workbooks are incomplete
                                        rowClass = 'bg-amber-50 border-l-4 border-amber-400';
                                    }
                                }
                                
                                return `
                                    <tr class="${rowClass}">
                                        <td class="px-4 py-3 text-sm text-slate-700">${app.date}</td>
                                        <td class="px-4 py-3 text-sm text-slate-700 font-medium">
                                            ${dayName}
                                            ${dayLabel}
                                        </td>
                                        <td class="px-4 py-3 text-sm text-slate-700">${app.time}</td>
                                        <td class="px-4 py-3 text-sm text-slate-700">
                                            ${type === 'Encounter' ? app.details : 
                                            `<span class="px-2 py-1 ${isSocialClub ? 
                                                'bg-amber-100 text-amber-800 font-semibold' : 
                                                'bg-teal-100 text-teal-700'} text-xs font-medium rounded">${app.details}</span>`}
                                        </td>
                                        ${type === 'Encounter' ? `
                                            <td class="px-2 py-2 text-center">${app.lessonStatus ? this.createModernStatusBadge(app.lessonStatus[1], 'L') : '<span class="text-slate-400 text-xs">-</span>'}</td>
                                            <td class="px-2 py-2 text-center">${app.lessonStatus ? this.createModernStatusBadge(app.lessonStatus[2], 'L') : '<span class="text-slate-400 text-xs">-</span>'}</td>
                                            <td class="px-2 py-2 text-center">${app.lessonStatus ? this.createModernStatusBadge(app.lessonStatus[3], 'L') : '<span class="text-slate-400 text-xs">-</span>'}</td>
                                            <td class="px-2 py-2 text-center">${app.workbookStatus ? this.createModernStatusBadge(app.workbookStatus[1], 'W') : '<span class="text-slate-400 text-xs">-</span>'}</td>
                                            <td class="px-2 py-2 text-center">${app.workbookStatus ? this.createModernStatusBadge(app.workbookStatus[2], 'W') : '<span class="text-slate-400 text-xs">-</span>'}</td>
                                            <td class="px-2 py-2 text-center">${app.workbookStatus ? this.createModernStatusBadge(app.workbookStatus[3], 'W') : '<span class="text-slate-400 text-xs">-</span>'}</td>
                                        ` : ''}
                                        ${type === 'Encounter' ? `<td class="px-4 py-3 text-center">
                                            ${app.overall ? this.formatScoresInline(app.overall) : '<span class="text-slate-400 text-xs">N/A</span>'}
                                        </td>` : ''}
                                        <td class="px-4 py-3 text-sm text-slate-700">${app.teacher}</td>
                                        ${type === 'Encounter' ? `<td class="px-4 py-3 text-center">
                                            ${app.feedback && app.result !== 'N/A' && app.result !== 'Pending' ? 
                                                this.createClickableResultBadge(app.result, app.feedback, student.userId, unitNumber, app.teacher, student.name) :
                                                this.createResultBadge(app.result)
                                            }
                                        </td>` : ''}
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
    }

    createModernStatusBadge(status, type) {
        if (status === 'C') {
            // Complete
            return `
                <div class="relative inline-flex items-center justify-center w-9 h-9">
                    <div class="absolute inset-0 bg-emerald-500 rounded-lg opacity-10"></div>
                    <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                </div>`;
        } else if (status === '(0%)') {
            // Not started
            return `
                <div class="relative inline-flex items-center justify-center w-9 h-9">
                    <div class="absolute inset-0 bg-slate-100 rounded-lg border border-slate-300"></div>
                    <span class="relative text-xs font-bold text-slate-500">0%</span>
                </div>`;
        } else if (status && status.includes('%')) {
            // In progress
            const percent = parseInt(status.match(/\((\d+)%\)/)?.[1] || 0);
            const circumference = 2 * Math.PI * 10;
            const strokeDashoffset = circumference - (percent / 100) * circumference;
            
            let color = 'text-red-500';
            let bgColor = 'bg-red-50';
            if (percent >= 75) {
                color = 'text-emerald-500';
                bgColor = 'bg-emerald-50';
            } else if (percent >= 50) {
                color = 'text-amber-500';
                bgColor = 'bg-amber-50';
            } else if (percent >= 25) {
                color = 'text-orange-500';
                bgColor = 'bg-orange-50';
            }
            
            return `
                <div class="relative inline-flex items-center justify-center w-9 h-9">
                    <div class="absolute inset-0 ${bgColor} rounded-lg opacity-50"></div>
                    <svg class="w-8 h-8 transform -rotate-90">
                        <circle cx="16" cy="16" r="10" stroke="currentColor" stroke-width="2" fill="none" class="text-slate-200"></circle>
                        <circle cx="16" cy="16" r="10" stroke="currentColor" stroke-width="2" fill="none" 
                                class="${color}" 
                                stroke-dasharray="${circumference}" 
                                stroke-dashoffset="${strokeDashoffset}"
                                stroke-linecap="round"></circle>
                    </svg>
                    <span class="absolute text-xs font-semibold text-slate-700">${percent}</span>
                </div>`;
        }
        return '<span class="text-slate-400 text-xs">-</span>';
    }

    createResultBadge(result) {
        const badges = {
            'Continue': 'bg-emerald-600 text-white',
            'Repeat': 'bg-red-600 text-white',
            'No Show': 'bg-slate-100 text-slate-600 border border-slate-300',
            'P': 'bg-amber-500 text-white',
            'N/A': 'bg-slate-200 text-slate-600',
            'Pending': 'bg-amber-500 text-white'
        };
        const classes = badges[result] || badges['N/A'];
        return `<span class="inline-block px-3 py-1 ${classes} text-xs font-semibold rounded-full">${result}</span>`;
    }

    createClickableResultBadge(result, feedback, userId, unitNumber, teacher = '', studentName = '') {
        const badges = {
            'Continue': 'bg-emerald-600 text-white hover:bg-emerald-700',
            'Repeat': 'bg-red-600 text-white hover:bg-red-700',
            'No Show': 'bg-slate-100 text-slate-600 border border-slate-300',
            'P': 'bg-amber-500 text-white',
            'N/A': 'bg-slate-200 text-slate-600',
            'Pending': 'bg-amber-500 text-white'
        };
        
        const classes = badges[result] || badges['N/A'];
        
        // Make badge clickable if there's feedback and result is not pending
        if (feedback && result !== 'P' && result !== 'N/A' && result !== 'Pending') {
            // Escape the feedback properly for onclick
            const escapedFeedback = feedback.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n');
            const unitDisplay = unitNumber ? `Unit ${unitNumber}` : '';
            
            return `
                <button onclick="window.wseApp.ui.showFeedbackModal('${escapedFeedback}', '${teacher}', '${unitDisplay}', '${studentName}')" 
                        class="inline-flex items-center gap-1 px-3 py-1 ${classes} text-xs font-semibold rounded-full cursor-pointer transition-all transform hover:scale-105"
                        title="Click to view feedback">
                    <span>${result}</span>
                    <i class="fas fa-comment-dots text-xs"></i>
                </button>`;
        } else {
            return `<span class="inline-block px-3 py-1 ${classes} text-xs font-semibold rounded-full">${result}</span>`;
        }
    }

    createCopyButton(text) {
        if (!text || text === 'N/A') {
            return '<span class="text-slate-400 text-xs">-</span>';
        }
        const cleanText = text.replace(/"/g, '&quot;').replace(/\n/g, '\\n');
        return `
            <button class="p-1.5 text-slate-600 hover:bg-slate-50 rounded-lg transition-all copy-btn" 
                    data-text="${cleanText}" 
                    title="Copy">
                <i class="fas fa-copy"></i>
            </button>`;
    }

    formatScoresInline(scores) {
        if (!scores || scores === 'N/A') {
            return '<span class="text-slate-400 text-xs">N/A</span>';
        }
        
        const [lPart, wPart] = scores.split(' ');
        const formatPart = (part) => {
            if (!part) return '';
            const [label, valueStr] = part.split(':');
            if (valueStr === '-') {
                return `<span class="text-slate-400">${label}:-</span>`;
            }
            const value = parseFloat(valueStr);
            const color = value >= 7 ? 'text-emerald-600' : 'text-red-600';
            return `<span class="${color} font-semibold">${label}:${value}</span>`;
        };
        
        return `<div class="flex items-center gap-2 justify-center">${formatPart(lPart)} ${formatPart(wPart)}</div>`;
    }

    formatScoresWithColors(scores) {
        if (!scores || scores === 'N/A') {
            return '<span class="text-slate-400 text-sm">N/A</span>';
        }
        
        const [lPart, wPart] = scores.split(' ');
        const formatPart = (part, goodThreshold) => {
            if (!part) return '';
            const [label, valueStr] = part.split(':');
            if (valueStr === '-') {
                return `<span class="text-slate-400 text-sm">${label}:-</span>`;
            }
            const value = parseFloat(valueStr);
            const color = value >= goodThreshold ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold';
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
            button.innerHTML = '<i class="fas fa-check text-emerald-600"></i>';
            button.classList.add('bg-emerald-50');
            this.showToast('Copied to clipboard!', 'success');
            
            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.classList.remove('bg-emerald-50');
            }, 2000);
        } catch (err) {
            this.showToast('Failed to copy text', 'error');
        }
    }

    // Back to original version without lesson/workbook status in profile modal
    showStudentProfileModal(profileData) {
        this.closeStudentProfileModal();
        
        const historyHTML = profileData.history && profileData.history.length > 0
            ? `
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="sticky top-0 bg-slate-50 z-10">
                            <tr class="border-b border-slate-200">
                                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Unit</th>
                                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Teacher</th>
                                <th class="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Score</th>
                                <th class="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Overall</th>
                                <th class="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Result</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${profileData.history.map(item => `
                                <tr class="hover:bg-slate-50">
                                    <td class="px-4 py-3 text-sm text-slate-700">${item.unit}</td>
                                    <td class="px-4 py-3 text-sm text-slate-700">${item.date || 'N/A'}</td>
                                    <td class="px-4 py-3 text-sm text-slate-700">${item.teacher}</td>
                                    <td class="px-4 py-3 text-center text-sm text-slate-700">${item.score}</td>
                                    <td class="px-4 py-3 text-center">${this.formatScoresWithColors(item.overall)}</td>
                                    <td class="px-4 py-3 text-center">
                                        ${item.feedback && item.result !== 'Pending' ? `
                                            <button onclick="this.blur(); const feedback = \`${item.feedback.replace(/`/g, '\\`').replace(/"/g, '&quot;').replace(/\n/g, '\\n')}\`; window.wseApp.ui.showFeedbackModal(feedback, '${item.teacher}', '${item.unit}', '${profileData.name}');" 
                                                    class="inline-flex items-center gap-1 px-3 py-1 ${item.result === 'Continue' ? 'bg-emerald-600' : item.result === 'Repeat' ? 'bg-red-600' : 'bg-slate-100'} ${item.result === 'No Show' ? 'text-slate-600 border border-slate-300' : 'text-white'} text-xs font-semibold rounded-full cursor-pointer transition-all transform hover:scale-105">
                                                <span>${item.result}</span>
                                                <i class="fas fa-comment-dots text-xs"></i>
                                            </button>` : 
                                            this.createResultBadge(item.result)
                                        }
                                    </td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>`
            : '<div class="text-center py-8 text-slate-500">No encounter history found.</div>';
        
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4';
        modal.id = 'studentProfileModalOverlay';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden animate-slide-up">
                <div class="bg-slate-700 text-white p-6">
                    <div class="flex items-center justify-between">
                        <h2 class="text-2xl font-bold">${profileData.name}</h2>
                        <button id="modalCloseBtn" 
                                class="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                <div class="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    <h3 class="text-lg font-semibold text-slate-900 mb-4">Encounter History</h3>
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

    showFeedbackModal(feedback, teacher = '', unit = '', studentName = '') {
        this.closeFeedbackModal();
        
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4';
        modal.id = 'feedbackModalOverlay';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden animate-slide-up">
                <div class="bg-slate-700 text-white p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <h2 class="text-xl font-bold flex items-center gap-2">
                                <i class="fas fa-comment-dots"></i>
                                Teacher Feedback
                            </h2>
                            ${(teacher || unit || studentName) ? `
                                <div class="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-200">
                                    ${studentName ? `<span><i class="fas fa-user mr-1"></i>${studentName}</span>` : ''}
                                    ${teacher ? `<span><i class="fas fa-chalkboard-teacher mr-1"></i>${teacher}</span>` : ''}
                                    ${unit ? `<span><i class="fas fa-book mr-1"></i>${unit}</span>` : ''}
                                </div>
                            ` : ''}
                        </div>
                        <button id="feedbackModalCloseBtn" 
                                class="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                <div class="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
                    <div class="bg-slate-50 border-l-4 border-slate-400 p-4 rounded-lg">
                        <p class="text-slate-700 leading-relaxed whitespace-pre-wrap">${feedback}</p>
                    </div>
                </div>
            </div>`;
        
        document.body.appendChild(modal);
        modal.querySelector('#feedbackModalCloseBtn').onclick = () => this.closeFeedbackModal();
        modal.onclick = (e) => {
            if (e.target === modal) this.closeFeedbackModal();
        };
    }

    closeFeedbackModal() {
        const modal = document.getElementById('feedbackModalOverlay');
        if (modal) {
            modal.classList.add('animate-fade-out');
            setTimeout(() => modal.remove(), 200);
        }
    }

    getEmptyStateHTML(message) {
        return `
            <div class="flex items-center justify-center min-h-[400px]">
                <div class="text-center max-w-md">
                    <div class="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-inbox text-slate-400 text-3xl"></i>
                    </div>
                    <h2 class="text-xl font-semibold text-slate-900 mb-2">No Data Available</h2>
                    <p class="text-slate-600">${message}</p>
                </div>
            </div>`;
    }

    updateDateTabs() {
        if (window.wseApp && window.wseApp.state) {
            this.generateDateTabs(this.currentMode, window.wseApp.state.data || {});
        }
    }
}