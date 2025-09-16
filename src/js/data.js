// data.js - Enhanced with time-based row highlighting
// Path: /src/js/data.js

import { CONFIG } from '../config/config.js';

export class DataProcessor {
    constructor() {
        this.dayOrder = {
            "Sunday": 0, "Monday": 1, "Tuesday": 2,
            "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6
        };
    }

    getCurrentDate() {
        const now = new Date();
        return now;
    }

    getTodayString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // New method to get current Saudi time
    getCurrentSaudiTime() {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const saudiTime = new Date(utc + (3600000 * 3)); // Saudi Arabia is UTC+3
        return saudiTime;
    }

    filterClasses(data, startDate, endDate) {
        const filtered = [];
        
        for (const cls of data) {
            if (cls.isOnline === true) continue;
            
            const startDateStr = cls.startDate;
            if (!startDateStr) continue;
            
            const classDate = new Date(startDateStr.split('T')[0] + 'T00:00:00');
            
            if (classDate >= startDate && classDate <= endDate) {
                if (cls.categoriesAbbreviations) {
                    filtered.push(cls);
                }
            }
        }
        
        return filtered;
    }

    isComplementaryClass(abbreviation) {
        if (!abbreviation) return false;
        
        if (abbreviation.includes(',')) {
            const parts = abbreviation.split(',');
            return parts.some(part => {
                const trimmed = part.trim();
                return trimmed.length === 2 && /^[A-Za-z][0-9]$/.test(trimmed);
            });
        }
        
        return abbreviation.length === 2 && /^[A-Za-z][0-9]$/.test(abbreviation);
    }

    parseDateTime(dateStr, timezoneOffset = CONFIG.TIMEZONE_OFFSET) {
        let datePart = "Unknown";
        let dayName = "Unknown";
        let timePart = "N/A";
        
        if (!dateStr || !dateStr.includes('T')) {
            return { date: datePart, day: dayName, time: timePart };
        }
        
        try {
            const parts = dateStr.split('T');
            datePart = parts[0];
            
            const dateObj = new Date(datePart + 'T00:00:00');
            dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
            
            if (parts[1] && parts[1].length >= 5) {
                const timeStr = parts[1].substring(0, 5);
                const [hours, minutes] = timeStr.split(':').map(Number);
                
                const adjustedHours = (hours + timezoneOffset) % 24;
                const period = adjustedHours >= 12 ? 'PM' : 'AM';
                const displayHours = adjustedHours % 12 || 12;
                
                timePart = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
            }
        } catch (error) {
            console.warn(`Error parsing datetime '${dateStr}':`, error);
        }
        
        return { date: datePart, day: dayName, time: timePart };
    }

    formatPhoneNumber(phone) {
        if (!phone || phone === "N/A") return "N/A";
        
        let cleaned = phone.replace(/[^\d+]/g, '');
        
        if (cleaned.startsWith("+966")) {
            if (cleaned.length > 4 && cleaned[4] === '0') {
                cleaned = "+966" + cleaned.substring(5);
            }
        } else if (cleaned.startsWith("0")) {
            cleaned = "+966" + cleaned.substring(1);
        } else if (!cleaned.startsWith("+")) {
            cleaned = "+966" + cleaned;
        }
        
        return cleaned;
    }

    processLessonStatus(lessonsSummaries) {
        const lessonStatus = { 1: "(0%)", 2: "(0%)", 3: "(0%)" };
        const workbookStatus = { 1: "(0%)", 2: "(0%)", 3: "(0%)" };
        
        if (!lessonsSummaries || lessonsSummaries.length === 0) {
            return { lessonStatus, workbookStatus };
        }
        
        for (const lesson of lessonsSummaries) {
            const lessonNumber = parseInt(lesson.lessonNumber);
            
            if (![1, 2, 3].includes(lessonNumber)) continue;
            
            // Process Activities
            if (lesson.activitiesSummary) {
                const progress = lesson.activitiesSummary.progress || 0;
                
                if (progress === 100) {
                    lessonStatus[lessonNumber] = "C";
                } else {
                    lessonStatus[lessonNumber] = `(${Math.round(progress)}%)`;
                }
            }
            
            // Process Workbooks
            if (lesson.workbooksSummary) {
                const progress = lesson.workbooksSummary.progress || 0;
                
                if (progress === 100) {
                    workbookStatus[lessonNumber] = "C";
                } else {
                    workbookStatus[lessonNumber] = `(${Math.round(progress)}%)`;
                }
            }
        }
        
        return { lessonStatus, workbookStatus };
    }

    getEncounterResult(levelData, unitNumber) {
        if (!levelData?.elements) return "P";
        
        for (const level of levelData.elements) {
            for (const unit of (level.units || [])) {
                if (String(unit.unitNumber) === String(unitNumber)) {
                    const result = unit.encounterSummary?.result || "";
                    
                    if (result.toLowerCase().includes("no show")) {
                        return "No Show";
                    } else if (result === "Continue") {
                        return "Continue";
                    } else if (result === "Repeat") {
                        return "Repeat";
                    } else if (result) {
                        return result;
                    }
                }
            }
        }
        
        return "P";
    }

    getUnitScores(levelData, unitNumber) {
        if (!levelData?.elements) return { lessonScore: null, workbookScore: null };
        
        for (const level of levelData.elements) {
            for (const unit of (level.units || [])) {
                if (String(unit.unitNumber) === String(unitNumber)) {
                    const lessonScore = unit.activitySummary?.overall || null;
                    const workbookScore = unit.workbookSummary?.overall || null;
                    
                    return { lessonScore, workbookScore };
                }
            }
        }
        
        return { lessonScore: null, workbookScore: null };
    }

    formatScores(lessonScore, workbookScore) {
        if (lessonScore === null && workbookScore === null) {
            return "N/A";
        }
        
        const parts = [];
        
        if (lessonScore !== null) {
            parts.push(`L:${lessonScore % 1 === 0 ? lessonScore : lessonScore.toFixed(1)}`);
        } else {
            parts.push("L:-");
        }
        
        if (workbookScore !== null) {
            parts.push(`W:${workbookScore % 1 === 0 ? workbookScore : workbookScore.toFixed(1)}`);
        } else {
            parts.push("W:-");
        }
        
        return parts.join(" ");
    }

    createClassReminder(phone, firstName, classTime, classDate, isCC = false) {
        if (phone === "N/A") return "N/A";
        
        const todayStr = this.getTodayString();
        
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        const todayDay = today.getDay();
        const tomorrowDay = tomorrow.getDay();
        
        let saturdayStr = null;
        if (todayDay === 4 && !isCC) {
            const saturday = new Date(today);
            saturday.setDate(today.getDate() + 2);
            saturdayStr = saturday.toISOString().split('T')[0];
        }
        
        const classType = isCC ? "CC" : "encounter class";
        
        if (classDate === todayStr) {
            return `Please don't miss your ${classType} today at ${classTime}.`;
        } 
        else if (classDate === tomorrowStr && tomorrowDay !== 5) {
            return `Hi, ${firstName}\n\nYou have ${isCC ? 'a CC' : 'an encounter class'} tomorrow at ${classTime}.`;
        } 
        else if (saturdayStr && classDate === saturdayStr) {
            return `Hi, ${firstName}\n\nYou have an encounter class on Saturday at ${classTime}.`;
        }
        
        return "N/A";
    }

    createHomeworkReminder(phone, lessonStatus, workbookStatus, classDate) {
        if (phone === "N/A") return "N/A";
        
        const todayStr = this.getTodayString();
        
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        const todayDay = today.getDay();
        const tomorrowDay = tomorrow.getDay();
        
        let saturdayStr = null;
        if (todayDay === 4) {
            const saturday = new Date(today);
            saturday.setDate(today.getDate() + 2);
            saturdayStr = saturday.toISOString().split('T')[0];
        }
        
        const isRelevantDate = classDate === todayStr || 
                              (classDate === tomorrowStr && tomorrowDay !== 5) || 
                              (saturdayStr && classDate === saturdayStr);
        
        if (!isRelevantDate) {
            return "N/A";
        }
        
        const incompleteL = [];
        const incompleteW = [];
        
        for (let i = 1; i <= 3; i++) {
            const lStatus = lessonStatus[i];
            const wStatus = workbookStatus[i];
            
            // Include (0%) as incomplete
            if (lStatus !== "C") {
                incompleteL.push(i);
            }
            
            // Include (0%) as incomplete
            if (wStatus !== "C") {
                incompleteW.push(i);
            }
        }
        
        if (incompleteL.length === 0 && incompleteW.length === 0) {
            return "N/A";
        }
        
        const parts = [];
        
        if (incompleteL.length > 0) {
            parts.push(`Lesson${incompleteL.length > 1 ? 's' : ''} ${incompleteL.join(',')}`);
        }
        
        if (incompleteW.length > 0) {
            parts.push(`Workbook${incompleteW.length > 1 ? 's' : ''} ${incompleteW.join(',')}`);
        }
        
        return `🛑 Please make sure you finish ( ${parts.join(' & ')} ) before your class`;
    }

    // NEW: Check if student needs highlighting based on time and homework status
    checkTimeBasedHighlight(classTime, classDate, lessonStatus, workbookStatus) {
        // Only check for today's classes
        const todayStr = this.getTodayString();
        if (classDate !== todayStr) {
            return null; // No highlighting for other days
        }

        // Parse class time
        const match = classTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!match) return null;

        let classHours = parseInt(match[1]);
        const classMinutes = parseInt(match[2]);
        const period = match[3].toUpperCase();

        // Convert to 24-hour format
        if (period === 'PM' && classHours !== 12) {
            classHours += 12;
        } else if (period === 'AM' && classHours === 12) {
            classHours = 0;
        }

        // Get current Saudi time
        const currentSaudiTime = this.getCurrentSaudiTime();
        const currentHours = currentSaudiTime.getHours();
        const currentMinutes = currentSaudiTime.getMinutes();

        // Calculate time difference in minutes
        const classTimeInMinutes = classHours * 60 + classMinutes;
        const currentTimeInMinutes = currentHours * 60 + currentMinutes;
        const timeDifference = classTimeInMinutes - currentTimeInMinutes;

        // Check if within 2 hours (120 minutes) before class
        if (timeDifference > 0 && timeDifference <= 120) {
            // Check homework completion status
            const incompleteLessons = [];
            const incompleteWorkbooks = [];

            for (let i = 1; i <= 3; i++) {
                if (lessonStatus[i] !== "C") {
                    incompleteLessons.push(i);
                }
                if (workbookStatus[i] !== "C") {
                    incompleteWorkbooks.push(i);
                }
            }

            // If only workbooks are incomplete
            if (incompleteLessons.length === 0 && incompleteWorkbooks.length > 0) {
                return 'warning'; // Orange highlighting
            }
            // If lessons are incomplete (with or without workbooks)
            else if (incompleteLessons.length > 0) {
                return 'danger'; // Red highlighting
            }
        }

        return null;
    }

    // FIXED: Enhanced processSelfBookingStudent to match self.py logic exactly
    processSelfBookingStudent(contract, contractDetails, redFlagProfiles) {
        if (!contract || !contract.studentId) {
            return null;
        }
        
        // Check if we have valid contract details
        if (!contractDetails || !contractDetails.contractViews) {
            console.warn(`No contract details for student ${contract.studentId}`);
            return null;
        }
        
        // Check for self-booking and get end date
        const hasBooking = this.hasSelfBooking(contractDetails);
        const endDate = this.getContractEndDate(contractDetails);
        
        // Only include if there's a valid end date (means active contract)
        if (!endDate) {
            console.log(`No valid end date for student ${contract.studentCode}`);
            return null;
        }
        
        // Build the student record
        const studentRecord = {
            code: contract.studentCode || "N/A",
            name: `${contract.firstName || ''} ${contract.lastName || ''}`.trim() || "N/A",
            endDate: endDate,
            hasSelfBooking: hasBooking,
            studentId: contract.studentId,
            isHighlighted: redFlagProfiles.includes(contract.studentId)
        };
        
        // Only return if student has self-booking
        return hasBooking ? studentRecord : null;
    }

    // FIXED: Match self.py logic exactly
    hasSelfBooking(contractData) {
        if (!contractData || !contractData.contractViews) {
            return false;
        }
        
        // Only check valid contracts (matching self.py logic)
        const validContracts = contractData.contractViews.filter(c => 
            c.contractStatus === "Valid"
        );
        
        // Check each valid contract for Self-booking product
        for (const contract of validContracts) {
            const products = contract.products || [];
            
            // Check if any product is named "Self-booking" (case-sensitive like in self.py)
            for (const product of products) {
                if (product.name === "Self-booking") {
                    return true;
                }
            }
        }
        
        return false;
    }

    // FIXED: Match self.py logic exactly
    getContractEndDate(contractData) {
        if (!contractData || !contractData.contractViews) {
            return null;
        }
        
        // Find valid contracts only (matching self.py logic)
        const validContracts = contractData.contractViews.filter(c => 
            c.contractStatus === "Valid"
        );
        
        if (validContracts.length === 0) {
            return null;
        }
        
        // Sort by end date (most recent first)
        validContracts.sort((a, b) => {
            const dateA = new Date(a.endDate || '1900-01-01');
            const dateB = new Date(b.endDate || '1900-01-01');
            return dateB - dateA; // Descending order
        });
        
        // Return the end date of the most recent valid contract
        const endDate = validContracts[0].endDate;
        return endDate || null;
    }

    processDataForDisplay(mode, currentDate, data, levelSummaries) {
        if (mode === 'self') {
            return data.self;
        }
        
        const classData = data[mode][currentDate] || [];
        const processed = [];
        
        if (mode === 'encounter') {
            // Group all encounter classes by time, not by unit
            const timeGroups = {};
            
            for (const cls of classData) {
                const unitNumber = cls.categories?.[0]?.attributes?.number;
                if (!unitNumber) continue;
                
                const datetime = this.parseDateTime(cls.originalStartDate || cls.startDate);
                const teacher = (cls.teacherFirstName || 'N/A').split(' ')[0];
                
                // Create unique key for each class (time + unit + teacher)
                const uniqueKey = `${datetime.time}_Unit${unitNumber}_${teacher}`;
                
                if (!timeGroups[uniqueKey]) {
                    timeGroups[uniqueKey] = {
                        time: datetime.time,
                        unit: `Unit ${unitNumber}`,
                        teacher: teacher,
                        students: []
                    };
                }
                
                const allStudents = [...(cls.bookedStudents || []), ...(cls.standbyStudents || [])];
                
                for (const studentWrapper of allStudents) {
                    const student = studentWrapper.student;
                    if (!student) continue;
                    
                    const processedStudent = this.processEncounterStudent(
                        student,
                        unitNumber,
                        datetime,
                        levelSummaries[student.userId],
                        cls.standbyStudents?.includes(studentWrapper)
                    );
                    
                    timeGroups[uniqueKey].students.push(processedStudent);
                }
            }
            
            // Convert to array and sort by time
            for (const group of Object.values(timeGroups)) {
                processed.push(group);
            }
            
            // Sort by time first, then by unit if times are the same
            processed.sort((a, b) => {
                const timeCompare = this.compareTime(a.time, b.time);
                if (timeCompare !== 0) return timeCompare;
                
                // If times are equal, sort by unit number
                const unitA = parseInt(a.unit.replace('Unit ', ''));
                const unitB = parseInt(b.unit.replace('Unit ', ''));
                return unitA - unitB;
            });
            
        } else if (mode === 'cc') {
            // Group CC classes by time instead of showing all in one table
            const timeGroups = {};
            
            for (const cls of classData) {
                const datetime = this.parseDateTime(cls.originalStartDate || cls.startDate);
                const teacher = (cls.teacherFirstName || 'N/A').split(' ')[0];
                const type = cls.categoriesAbbreviations || 'N/A';
                
                // Use time as the grouping key
                const timeKey = datetime.time;
                if (!timeGroups[timeKey]) {
                    timeGroups[timeKey] = {
                        time: timeKey,
                        classes: []
                    };
                }
                
                const students = [];
                const allStudents = [...(cls.bookedStudents || []), ...(cls.standbyStudents || [])];
                
                for (const studentWrapper of allStudents) {
                    const student = studentWrapper.student;
                    if (!student) continue;
                    
                    const firstName = (student.firstName || 'N/A').split(' ')[0];
                    const phone = this.formatPhoneNumber(student.mobileTelephone);
                    
                    students.push({
                        code: student.studentCode || 'N/A',
                        name: firstName,
                        phone: phone,  // Still keep phone for message creation
                        type: type,
                        teacher: teacher,
                        profileUrl: `https://world.wallstreetenglish.com/profile/${student.userId}/gradeBook`,
                        message: this.createClassReminder(phone, firstName, datetime.time, datetime.date, true)
                    });
                }
                
                timeGroups[timeKey].classes.push(...students);
            }
            
            // Convert to array and sort by time properly
            for (const [time, group] of Object.entries(timeGroups)) {
                processed.push({
                    time: time,
                    students: group.classes
                });
            }
            
            // Sort using the fixed compareTime function
            processed.sort((a, b) => this.compareTime(a.time, b.time));
        }
        
        return processed;
    }

    processEncounterStudent(student, unitNumber, datetime, levelData, isStandby = false) {
        const firstName = (student.firstName || 'N/A').split(' ')[0];
        const phone = this.formatPhoneNumber(student.mobileTelephone);
        
        const lessonSummaries = student.lessonSummaries?.[unitNumber] || [];
        const { lessonStatus, workbookStatus } = this.processLessonStatus(lessonSummaries);
        
        const { lessonScore, workbookScore } = this.getUnitScores(levelData, unitNumber);
        const scores = this.formatScores(lessonScore, workbookScore);
        const result = this.getEncounterResult(levelData, unitNumber);
        
        const message = this.createClassReminder(phone, firstName, datetime.time, datetime.date, false);
        const homework = this.createHomeworkReminder(phone, lessonStatus, workbookStatus, datetime.date);
        
        // NEW: Check for time-based highlighting
        const timeHighlight = this.checkTimeBasedHighlight(datetime.time, datetime.date, lessonStatus, workbookStatus);
        
        return {
            code: student.studentCode || 'N/A',
            name: firstName,
            phone: phone,  // Still keep phone for message creation
            profileUrl: `https://world.wallstreetenglish.com/profile/${student.userId}/gradeBook`,
            lessons: lessonStatus,
            workbooks: workbookStatus,
            scores: scores,
            result: result,
            message: message,
            homework: homework,
            isStandby: isStandby,
            timeHighlight: timeHighlight  // NEW: Add time-based highlight status
        };
    }

    compareTime(timeA, timeB) {
        const parseTime = (timeStr) => {
            if (!timeStr || timeStr === "N/A") return 9999; // Put N/A at the end
            
            const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (!match) return 9999;
            
            let hours = parseInt(match[1]);
            const minutes = parseInt(match[2]);
            const period = match[3].toUpperCase();
            
            // Fix 12 hour conversion
            if (period === 'PM' && hours !== 12) {
                hours += 12;
            } else if (period === 'AM' && hours === 12) {
                hours = 0;
            }
            
            return hours * 60 + minutes;
        };
        
        const timeAMinutes = parseTime(timeA);
        const timeBMinutes = parseTime(timeB);
        
        return timeAMinutes - timeBMinutes;
    }
}