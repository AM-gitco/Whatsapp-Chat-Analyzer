  // Set current year in footer
        document.getElementById('currentYear').textContent = new Date().getFullYear();
        
        // File input text update
        document.getElementById('fileInput').addEventListener('change', function(e) {
            const fileName = e.target.files[0]?.name || 'Select exported WhatsApp chat (.txt)';
            document.getElementById('fileInputText').textContent = fileName;
        });

        // Theme toggle functionality
        const themeToggle = document.getElementById('themeToggle');
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const icon = themeToggle.querySelector('i');
            if (document.body.classList.contains('dark-mode')) {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
            } else {
                icon.classList.remove('fa-sun');
                icon.classList.add('fa-moon');
            }
        });

        // Tab functionality
        document.querySelectorAll('.tab-btn').forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from all buttons and content
                document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked button
                button.classList.add('active');
                
                // Show corresponding content
                const tabId = button.getAttribute('data-tab');
                document.getElementById(`${tabId}Tab`).classList.add('active');
                
                // If wordcloud tab is selected, generate word cloud
                if (tabId === 'wordcloud') {
                    generateWordCloud();
                }
            });
        });

        let myMsgs = 0, friendMsgs = 0;
        let myWords = 0, friendWords = 0;
        let myLetters = 0, friendLetters = 0;
        let myEmojis = 0, friendEmojis = 0;
        let myEmojiList = [], friendEmojiList = [];
        let myWordList = [], friendWordList = [];
        let myMessageList = [], friendMessageList = [];
        let messageDates = [];
        let myName, friendName;
        let messageTimes = [];
        let messageDays = [];
        let messageCountByDate = {};
        let longestStreak = { duration: 0, start: null, end: null, messages: 0 };
        let messageTimestamps = [];
        let userTimeStats = { morning: 0, afternoon: 0, evening: 0, night: 0 };
        let friendTimeStats = { morning: 0, afternoon: 0, evening: 0, night: 0 };
        let userDayStats = { Sunday: 0, Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0 };
        let friendDayStats = { Sunday: 0, Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0 };

        function showError(message) {
            const errorElement = document.getElementById('errorMessage');
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            
            // Hide error after 5 seconds
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 5000);
        }

        function startAnalysis() {
            myName = document.getElementById("myNameInput").value.trim();
            friendName = document.getElementById("friendNameInput").value.trim();
            const fileInput = document.getElementById("fileInput");

            if (!myName || !friendName) {
                showError("Please enter both your name and your friend's name.");
                return;
            }

            if (!fileInput.files.length) {
                showError("Please select a WhatsApp chat file to analyze.");
                return;
            }

            // Show loading state
            document.getElementById("inputSection").style.display = "none";
            document.getElementById("loadingSection").style.display = "block";
            document.getElementById("resultsSection").style.display = "none";
            document.getElementById("errorMessage").style.display = "none";

            const file = fileInput.files[0];
            const reader = new FileReader();

            reader.onload = function(e) {
                resetCounters();
                const content = e.target.result;
                const lines = content.split("\n");

                // Process each line
                for (let i = 0; i < lines.length; i++) {
                    processMessage(lines[i]);
                }

                // Display results
                displayResults();
                document.getElementById("loadingSection").style.display = "none";
                document.getElementById("resultsSection").style.display = "block";
            };

            reader.onerror = function() {
                showError("Error reading the file. Please try again.");
                document.getElementById("loadingSection").style.display = "none";
                document.getElementById("inputSection").style.display = "block";
            };

            reader.readAsText(file);
        }

        function parseDateTime(dateTimeStr) {
            // Handle format like "6/27/24, 11:42 PM"
            try {
                // Replace special space character with regular space
                dateTimeStr = dateTimeStr.replace(/\u202f/g, ' ');
                
                const [datePart, timePart] = dateTimeStr.split(', ');
                if (!datePart || !timePart) return null;
                
                const [month, day, year] = datePart.split('/').map(num => parseInt(num, 10));
                let [time, period] = timePart.split(' ');
                const [hours, minutes] = time.split(':').map(num => parseInt(num, 10));
                
                // Convert to 24-hour format
                let hours24 = hours;
                if (period === 'PM' && hours !== 12) {
                    hours24 = hours + 12;
                } else if (period === 'AM' && hours === 12) {
                    hours24 = 0;
                }
                
                // Create date object (assuming 2000s for years)
                return new Date(2000 + year, month - 1, day, hours24, minutes);
            } catch (error) {
                console.error("Error parsing date:", dateTimeStr, error);
                return null;
            }
        }

        function processMessage(line) {
            const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B06}\u{2194}\u{2192}\u{2B06}\u{21A9}-\u{21AA}\u{2934}\u{2935}\u{203C}\u{2049}\u{2049}\u{2122}]/gu;
            
            // Skip empty lines or lines that don't contain message content
            if (!line || line.trim().length === 0) return;
            
            // Handle different WhatsApp export formats
            let sender, messageContent, dateTimeStr;
            
            // Format: MM/DD/YY, HH:MM AM/PM - Name: Message
            if (line.includes(' - ')) {
                const dashIndex = line.indexOf(' - ');
                if (dashIndex === -1) return;
                
                dateTimeStr = line.substring(0, dashIndex);
                const afterDash = line.substring(dashIndex + 3); // Skip ' - '
                
                const colonIndex = afterDash.indexOf(':');
                if (colonIndex === -1) return;
                
                sender = afterDash.substring(0, colonIndex).trim();
                messageContent = afterDash.substring(colonIndex + 1).trim();
                
                // Parse the date and time
                const dateObj = parseDateTime(dateTimeStr);
                if (!dateObj) return;
                
                // Store timestamp for response time calculation
                messageTimestamps.push({
                    date: dateObj,
                    sender: sender,
                    content: messageContent
                });
                
                // Format the date for messageDates and messageCountByDate
                const dateKey = `${dateObj.getMonth()+1}/${dateObj.getDate()}/${dateObj.getFullYear().toString().slice(-2)}`;
                messageDates.push(dateKey);
                
                // Count messages by date
                if (!messageCountByDate[dateKey]) {
                    messageCountByDate[dateKey] = 0;
                }
                messageCountByDate[dateKey]++;
                
                // Get day of week
                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const dayOfWeek = days[dateObj.getDay()];
                messageDays.push(dayOfWeek);
                
                // Get hour of day (in 24-hour format)
                const hour = dateObj.getHours();
                messageTimes.push(hour);
            } else {
                // Unrecognized format
                return;
            }
            
            // Determine if sender is you or your friend
            let senderType = null;
            if (sender.toLowerCase().includes(myName.toLowerCase())) {
                senderType = "my";
            } else if (sender.toLowerCase().includes(friendName.toLowerCase())) {
                senderType = "friend";
            } else {
                // Skip if sender doesn't match either name
                return;
            }
            
            if (!messageContent) return;

            if (senderType === "my") {
                myMsgs++;
                const words = extractWords(messageContent);
                myWords += words.length;
                myWordList = myWordList.concat(words);
                myLetters += messageContent.replace(/\s+/g, '').length;
                const emojis = messageContent.match(emojiRegex);
                if (emojis) {
                    myEmojis += emojis.length;
                    myEmojiList.push(...emojis);
                }
                // Store message for repetition analysis
                myMessageList.push(messageContent);
                
                // Update time and day statistics for user
                updateTimeStats(userTimeStats, messageTimes[messageTimes.length - 1]);
                updateDayStats(userDayStats, messageDays[messageDays.length - 1]);
            } else if (senderType === "friend") {
                friendMsgs++;
                const words = extractWords(messageContent);
                friendWords += words.length;
                friendWordList = friendWordList.concat(words);
                friendLetters += messageContent.replace(/\s+/g, '').length;
                const emojis = messageContent.match(emojiRegex);
                if (emojis) {
                    friendEmojis += emojis.length;
                    friendEmojiList.push(...emojis);
                }
                // Store message for repetition analysis
                friendMessageList.push(messageContent);
                
                // Update time and day statistics for friend
                updateTimeStats(friendTimeStats, messageTimes[messageTimes.length - 1]);
                updateDayStats(friendDayStats, messageDays[messageDays.length - 1]);
            }
        }

        function updateTimeStats(timeStats, hour) {
            if (hour >= 5 && hour < 12) {
                timeStats.morning++;
            } else if (hour >= 12 && hour < 17) {
                timeStats.afternoon++;
            } else if (hour >= 17 && hour < 21) {
                timeStats.evening++;
            } else {
                timeStats.night++;
            }
        }

        function updateDayStats(dayStats, day) {
            if (dayStats.hasOwnProperty(day)) {
                dayStats[day]++;
            }
        }

        function extractWords(message) {
            // Remove emojis and special characters, then split into words
            return message.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B06}\u{2194}\u{2192}\u{2B06}\u{21A9}-\u{21AA}\u{2934}\u{2935}\u{203C}\u{2049}\u{2049}\u{2122}]/gu, '')
                .replace(/[^\w\s]/gi, ' ')
                .toLowerCase()
                .split(/\s+/)
                .filter(word => word.length > 2); // Filter out short words
        }

        function resetCounters() {
            myMsgs = 0;
            friendMsgs = 0;
            myWords = 0;
            friendWords = 0;
            myLetters = 0;
            friendLetters = 0;
            myEmojis = 0;
            friendEmojis = 0;
            myEmojiList = [];
            friendEmojiList = [];
            myWordList = [];
            friendWordList = [];
            myMessageList = [];
            friendMessageList = [];
            messageDates = [];
            messageTimes = [];
            messageDays = [];
            messageCountByDate = {};
            longestStreak = { duration: 0, start: null, end: null, messages: 0 };
            messageTimestamps = [];
            userTimeStats = { morning: 0, afternoon: 0, evening: 0, night: 0 };
            friendTimeStats = { morning: 0, afternoon: 0, evening: 0, night: 0 };
            userDayStats = { Sunday: 0, Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0 };
            friendDayStats = { Sunday: 0, Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0 };
        }

        function displayResults() {
            // Update all name placeholders
            document.querySelectorAll('[id^=userName]').forEach(el => {
                el.textContent = myName;
            });
            document.querySelectorAll('[id^=friendName]').forEach(el => {
                el.textContent = friendName;
            });
            
            // Update statistics
            document.getElementById('totalMessages').textContent = myMsgs + friendMsgs;
            document.getElementById('userMessages').textContent = myMsgs;
            document.getElementById('friendMessages').textContent = friendMsgs;
            
            document.getElementById('totalWords').textContent = myWords + friendWords;
            document.getElementById('userWords').textContent = myWords;
            document.getElementById('friendWords').textContent = friendWords;
            
            document.getElementById('totalChars').textContent = myLetters + friendLetters;
            document.getElementById('userChars').textContent = myLetters;
            document.getElementById('friendChars').textContent = friendLetters;
            
            document.getElementById('totalEmojis').textContent = myEmojis + friendEmojis;
            document.getElementById('userEmojis').textContent = myEmojis;
            document.getElementById('friendEmojis').textContent = friendEmojis;
            
            // Create charts
            createCharts();
            
            // Display emojis
            displayEmojis();
            
            // Display top words
            displayTopWords();
            
            // Display repeated messages
            displayRepeatedMessages();
            
            // Process and display streaks
            processStreaks();
            
            // Calculate insights
            calculateInsights();
            
            // Update summary stats
            updateSummaryStats();
        }

        function displayEmojis() {
            const userEmojiContainer = document.getElementById('userEmojisContainer');
            const friendEmojiContainer = document.getElementById('friendEmojisContainer');
            
            userEmojiContainer.innerHTML = '';
            friendEmojiContainer.innerHTML = '';
            
            // Show unique emojis with frequency
            const userEmojiCount = {};
            myEmojiList.forEach(emoji => {
                userEmojiCount[emoji] = (userEmojiCount[emoji] || 0) + 1;
            });
            
            const friendEmojiCount = {};
            friendEmojiList.forEach(emoji => {
                friendEmojiCount[emoji] = (friendEmojiCount[emoji] || 0) + 1;
            });
            
            // Sort by frequency and display
            Object.entries(userEmojiCount)
                .sort((a, b) => b[1] - a[1])
                .forEach(([emoji, count]) => {
                    const emojiEl = document.createElement('div');
                    emojiEl.className = 'emoji-item';
                    emojiEl.innerHTML = `
                        <div class="emoji">${emoji}</div>
                        <div class="emoji-count">${count}</div>
                    `;
                    userEmojiContainer.appendChild(emojiEl);
                });
                
            Object.entries(friendEmojiCount)
                .sort((a, b) => b[1] - a[1])
                .forEach(([emoji, count]) => {
                    const emojiEl = document.createElement('div');
                    emojiEl.className = 'emoji-item';
                    emojiEl.innerHTML = `
                        <div class="emoji">${emoji}</div>
                        <div class="emoji-count">${count}</div>
                    `;
                    friendEmojiContainer.appendChild(emojiEl);
                });
        }

        function displayTopWords() {
            const userWordsContainer = document.getElementById('userWordsContainer');
            const friendWordsContainer = document.getElementById('friendWordsContainer');
            
            userWordsContainer.innerHTML = '';
            friendWordsContainer.innerHTML = '';
            
            // Count word frequency
            const userWordCount = {};
            myWordList.forEach(word => {
                userWordCount[word] = (userWordCount[word] || 0) + 1;
            });
            
            const friendWordCount = {};
            friendWordList.forEach(word => {
                friendWordCount[word] = (friendWordCount[word] || 0) + 1;
            });
            
            // Sort by frequency and display top 20
            Object.entries(userWordCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 20)
                .forEach(([word, count]) => {
                    const wordEl = document.createElement('div');
                    wordEl.className = 'word-item';
                    wordEl.innerHTML = `
                        <div class="word">${word}</div>
                        <div class="word-count">${count}</div>
                    `;
                    userWordsContainer.appendChild(wordEl);
                });
                
            Object.entries(friendWordCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 20)
                .forEach(([word, count]) => {
                    const wordEl = document.createElement('div');
                    wordEl.className = 'word-item';
                    wordEl.innerHTML = `
                        <div class="word">${word}</div>
                        <div class="word-count">${count}</div>
                    `;
                    friendWordsContainer.appendChild(wordEl);
                });
        }

        function displayRepeatedMessages() {
            const userMessagesContainer = document.getElementById('userMessagesContainer');
            const friendMessagesContainer = document.getElementById('friendMessagesContainer');
            
            userMessagesContainer.innerHTML = '';
            friendMessagesContainer.innerHTML = '';
            
            // Count message frequency
            const userMessageCount = {};
            myMessageList.forEach(message => {
                // Only count messages longer than 5 characters to avoid very short messages
                if (message.length > 5) {
                    userMessageCount[message] = (userMessageCount[message] || 0) + 1;
                }
            });
            
            const friendMessageCount = {};
            friendMessageList.forEach(message => {
                // Only count messages longer than 5 characters to avoid very short messages
                if (message.length > 5) {
                    friendMessageCount[message] = (friendMessageCount[message] || 0) + 1;
                }
            });
            
            // Sort by frequency and display top 20
            Object.entries(userMessageCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 20)
                .forEach(([message, count]) => {
                    if (count > 1) { // Only show messages that were repeated
                        const messageEl = document.createElement('div');
                        messageEl.className = 'message-item';
                        messageEl.innerHTML = `
                            <div class="message-text">${message}</div>
                            <div class="message-count"><i class="fas fa-redo"></i> Sent ${count} times</div>
                        `;
                        userMessagesContainer.appendChild(messageEl);
                    }
                });
                
            Object.entries(friendMessageCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 20)
                .forEach(([message, count]) => {
                    if (count > 1) { // Only show messages that were repeated
                        const messageEl = document.createElement('div');
                        messageEl.className = 'message-item';
                        messageEl.innerHTML = `
                            <div class="message-text">${message}</div>
                            <div class="message-count"><i class="fas fa-redo"></i> Sent ${count} times</div>
                        `;
                        friendMessagesContainer.appendChild(messageEl);
                    }
                });
        }

        // Process chat activity streaks
        function processStreaks() {
            const streaksContainer = document.getElementById('streaksContainer');
            streaksContainer.innerHTML = '';

            if (messageDates.length < 2) {
                streaksContainer.innerHTML = '<p>Not enough data to calculate streaks</p>';
                return;
            }

            // Parse dates into JS Date objects
            const parsedDates = [];
            messageDates.forEach(d => {
                try {
                    let rawDate = d.split(",")[0].trim(); // e.g. "6/25/24"
                    let parts = rawDate.split("/"); 

                    // Handle month/day/year (US WhatsApp format)
                    let month = parseInt(parts[0], 10) - 1;
                    let day = parseInt(parts[1], 10);
                    let year = parts[2].length === 2 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10);

                    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                        parsedDates.push(new Date(year, month, day));
                    }
                } catch (err) {
                    console.warn("Date parse error for line:", d, err);
                }
            });

            if (parsedDates.length === 0) {
                streaksContainer.innerHTML = '<p>No valid dates found in file</p>';
                return;
            }

            // Sort and remove duplicate days
            parsedDates.sort((a, b) => a - b);
            let uniqueDates = [...new Set(parsedDates.map(d => d.toDateString()))]
                .map(d => new Date(d));

            let streaks = [];
            let breaks = [];

            let streakStart = uniqueDates[0];
            let prevDate = uniqueDates[0];
            let currentStreakMessages = messageCountByDate[formatDateForKey(streakStart)] || 0;

            for (let i = 1; i < uniqueDates.length; i++) {
                let currDate = uniqueDates[i];
                let diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));

                if (diffDays === 1) {
                    // Still part of streak
                    currentStreakMessages += messageCountByDate[formatDateForKey(currDate)] || 0;
                    prevDate = currDate;
                } else {
                    // Streak ended
                    const streakDuration = Math.round((prevDate - streakStart) / (1000 * 60 * 60 * 24)) + 1;
                    streaks.push({
                        start: formatDate(streakStart),
                        end: formatDate(prevDate),
                        duration: `${streakDuration} days`,
                        messages: currentStreakMessages
                    });

                    // Update longest streak if needed
                    if (streakDuration > longestStreak.duration) {
                        longestStreak = {
                            duration: streakDuration,
                            start: formatDate(streakStart),
                            end: formatDate(prevDate),
                            messages: currentStreakMessages
                        };
                    }

                    // Add break if gap > 1 day
                    if (diffDays > 1) {
                        breaks.push({
                            start: formatDate(new Date(prevDate.getTime() + 24*60*60*1000)),
                            end: formatDate(new Date(currDate.getTime() - 24*60*60*1000)),
                            duration: `${diffDays - 1} days`
                        });
                    }

                    // Start new streak
                    streakStart = currDate;
                    prevDate = currDate;
                    currentStreakMessages = messageCountByDate[formatDateForKey(currDate)] || 0;
                }
            }

            // Push last streak
            const streakDuration = Math.round((prevDate - streakStart) / (1000 * 60 * 60 * 24)) + 1;
            streaks.push({
                start: formatDate(streakStart),
                end: formatDate(prevDate),
                duration: `${streakDuration} days`,
                messages: currentStreakMessages
            });

            // Update longest streak if needed
            if (streakDuration > longestStreak.duration) {
                longestStreak = {
                    duration: streakDuration,
                    start: formatDate(streakStart),
                    end: formatDate(prevDate),
                    messages: currentStreakMessages
                };
            }

            // Display streaks
            streaks.forEach(streak => {
                const streakEl = document.createElement('div');
                streakEl.className = 'streak-item';
                streakEl.innerHTML = `
                    <span class="streak-dates">${streak.start} – ${streak.end}</span>
                    <span class="streak-duration"><i class="fas fa-fire"></i> ${streak.duration}</span>
                    <div style="margin-top: 8px; font-size: 0.9rem; color: #666;">
                        <i class="fas fa-comments"></i> ${streak.messages} messages
                    </div>
                `;
                streaksContainer.appendChild(streakEl);
            });

            // Display breaks
            const breaksContainer = document.getElementById('breaksContainer');
            breaksContainer.innerHTML = '';
            
            breaks.forEach(breakItem => {
                const breakEl = document.createElement('div');
                breakEl.className = 'break-item';
                breakEl.innerHTML = `
                    <strong>${breakItem.duration} break</strong>: ${breakItem.start} – ${breakItem.end}
                `;
                breaksContainer.appendChild(breakEl);
            });
        }

        // Helper: format date as DD/MM/YYYY for display
        function formatDate(date) {
            let d = date.getDate().toString().padStart(2, '0');
            let m = (date.getMonth() + 1).toString().padStart(2, '0');
            let y = date.getFullYear();
            return `${d}/${m}/${y}`;
        }

        // Helper: format date as MM/DD/YY for key matching
        function formatDateForKey(date) {
            let d = date.getDate().toString();
            let m = (date.getMonth() + 1).toString();
            let y = date.getFullYear().toString().slice(-2);
            return `${m}/${d}/${y}`;
        }

        function createCharts() {
            // Stats comparison chart
            const statsCtx = document.getElementById('statsChart').getContext('2d');
            new Chart(statsCtx, {
                type: 'bar',
                data: {
                    labels: ['Messages', 'Words', 'Characters', 'Emojis'],
                    datasets: [
                        {
                            label: myName,
                            data: [myMsgs, myWords, myLetters, myEmojis],
                            backgroundColor: '#25D366',
                            borderColor: '#128C7E',
                            borderWidth: 1
                        },
                        {
                            label: friendName,
                            data: [friendMsgs, friendWords, friendLetters, friendEmojis],
                            backgroundColor: '#34B7F1',
                            borderColor: '#1E88E5',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });

            // Activity by day of week chart
            const dayOfWeekCtx = document.getElementById('dayOfWeekChart').getContext('2d');
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayCounts = days.map(day => messageDays.filter(d => d === day).length);
            
            new Chart(dayOfWeekCtx, {
                type: 'bar',
                data: {
                    labels: days,
                    datasets: [{
                        label: 'Messages',
                        data: dayCounts,
                        backgroundColor: '#25D366',
                        borderColor: '#128C7E',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });

            // Activity by hour of day chart
            const hourOfDayCtx = document.getElementById('hourOfDayChart').getContext('2d');
            const hours = Array.from({length: 24}, (_, i) => i);
            const hourCounts = hours.map(hour => {
                return messageTimes.filter(time => time === hour).length;
            });
            
            new Chart(hourOfDayCtx, {
                type: 'bar',
                data: {
                    labels: hours.map(h => `${h}:00`),
                    datasets: [{
                        label: 'Messages',
                        data: hourCounts,
                        backgroundColor: '#25D366',
                        borderColor: '#128C7E',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });

            // Activity timeline chart
            const timelineCtx = document.getElementById('timelineChart').getContext('2d');
            
            // Get sorted dates for timeline
            const sortedDates = Object.keys(messageCountByDate).sort((a, b) => {
                const [aMonth, aDay, aYear] = a.split('/').map(Number);
                const [bMonth, bDay, bYear] = b.split('/').map(Number);
                const aDate = new Date(2000 + aYear, aMonth - 1, aDay);
                const bDate = new Date(2000 + bYear, bMonth - 1, bDay);
                return aDate - bDate;
            });
            
            const timelineData = sortedDates.map(date => messageCountByDate[date]);
            
            new Chart(timelineCtx, {
                type: 'line',
                data: {
                    labels: sortedDates,
                    datasets: [{
                        label: 'Messages per Day',
                        data: timelineData,
                        backgroundColor: 'rgba(37, 211, 102, 0.2)',
                        borderColor: '#25D366',
                        borderWidth: 2,
                        pointRadius: 3,
                        pointBackgroundColor: '#25D366',
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        },
                        x: {
                            ticks: {
                                maxTicksLimit: 10,
                                callback: function(value, index, values) {
                                    return sortedDates[index];
                                }
                            }
                        }
                    }
                }
            });
        }

        function calculateInsights() {
            // Calculate days talking
            const uniqueDates = [...new Set(messageDates)];
            const totalDays = uniqueDates.length;
            
            // Calculate average messages per day
            const avgMessages = (myMsgs + friendMsgs) / totalDays;
            
            // Determine chat level based on message count
            const totalMessages = myMsgs + friendMsgs;
            let chatLevel = "New";
            if (totalMessages > 1000) chatLevel = "Active";
            if (totalMessages > 5000) chatLevel = "Very Active";
            if (totalMessages > 10000) chatLevel = "Super Active";
            
            // Calculate most active day
            const dayCounts = {
                'Sunday': 0, 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 
                'Thursday': 0, 'Friday': 0, 'Saturday': 0
            };
            
            messageDays.forEach(day => {
                if (dayCounts.hasOwnProperty(day)) {
                    dayCounts[day]++;
                }
            });
            
            let mostActiveDay = "Sunday";
            let maxDayCount = 0;
            
            for (const day in dayCounts) {
                if (dayCounts[day] > maxDayCount) {
                    maxDayCount = dayCounts[day];
                    mostActiveDay = day;
                }
            }
            
            // Calculate most active hour
            const hourCounts = Array(24).fill(0);
            messageTimes.forEach(hour => {
                if (hour >= 0 && hour <= 23) {
                    hourCounts[hour]++;
                }
            });
            
            const mostActiveHour = hourCounts.indexOf(Math.max(...hourCounts));
            const mostActiveHourFormatted = mostActiveHour < 12 ? `${mostActiveHour} AM` : `${mostActiveHour - 12} PM`;
            
            // Calculate engagement percentages
            const totalMsgs = myMsgs + friendMsgs;
            const userEngagement = totalMsgs > 0 ? Math.round((myMsgs / totalMsgs) * 100) : 0;
            const friendEngagement = totalMsgs > 0 ? Math.round((friendMsgs / totalMsgs) * 100) : 0;
            
            // Calculate response times
            let responseTimes = [];
            for (let i = 1; i < messageTimestamps.length; i++) {
                const current = messageTimestamps[i];
                const previous = messageTimestamps[i-1];
                
                if (current.sender !== previous.sender) {
                    const diffMs = current.date - previous.date;
                    const diffMins = Math.round(diffMs / (1000 * 60));
                    if (diffMins > 0 && diffMins < 1440) { // Only count responses within 24 hours
                        responseTimes.push(diffMins);
                    }
                }
            }
            
            const avgResponseTime = responseTimes.length > 0 
                ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) 
                : 0;
            
            // Update insight elements
            document.getElementById('longestStreak').textContent = longestStreak.duration + " days";
            
            // Calculate favorite emojis
            const userEmojiCount = {};
            myEmojiList.forEach(emoji => {
                userEmojiCount[emoji] = (userEmojiCount[emoji] || 0) + 1;
            });
            
            const friendEmojiCount = {};
            friendEmojiList.forEach(emoji => {
                friendEmojiCount[emoji] = (friendEmojiCount[emoji] || 0) + 1;
            });
            
            const allEmojiCount = {};
            [...myEmojiList, ...friendEmojiList].forEach(emoji => {
                allEmojiCount[emoji] = (allEmojiCount[emoji] || 0) + 1;
            });
            
            // Get most used emoji for user
            let userFavoriteEmoji = "😊";
            let userMaxCount = 0;
            for (const emoji in userEmojiCount) {
                if (userEmojiCount[emoji] > userMaxCount) {
                    userMaxCount = userEmojiCount[emoji];
                    userFavoriteEmoji = emoji;
                }
            }
            
            // Get most used emoji for friend
            let friendFavoriteEmoji = "😊";
            let friendMaxCount = 0;
            for (const emoji in friendEmojiCount) {
                if (friendEmojiCount[emoji] > friendMaxCount) {
                    friendMaxCount = friendEmojiCount[emoji];
                    friendFavoriteEmoji = emoji;
                }
            }
            
            // Get most used emoji overall
            let favoriteEmoji = "😊";
            let maxCount = 0;
            for (const emoji in allEmojiCount) {
                if (allEmojiCount[emoji] > maxCount) {
                    maxCount = allEmojiCount[emoji];
                    favoriteEmoji = emoji;
                }
            }
            
            // Get most active time for user and friend
            const getMostActiveTime = (timeStats) => {
                let max = 0;
                let mostActive = "Morning";
                
                for (const time in timeStats) {
                    if (timeStats[time] > max) {
                        max = timeStats[time];
                        mostActive = time;
                    }
                }
                
                return mostActive;
            };
            
            const userMostActiveTime = getMostActiveTime(userTimeStats);
            const friendMostActiveTime = getMostActiveTime(friendTimeStats);
            const overallMostActiveTime = userTimeStats[userMostActiveTime] > friendTimeStats[friendMostActiveTime] ? userMostActiveTime : friendMostActiveTime;
            
            // Get most active day for user and friend
            const getMostActiveDay = (dayStats) => {
                let max = 0;
                let mostActive = "Sunday";
                
                for (const day in dayStats) {
                    if (dayStats[day] > max) {
                        max = dayStats[day];
                        mostActive = day;
                    }
                }
                
                return mostActive;
            };
            
            const userMostActiveDay = getMostActiveDay(userDayStats);
            const friendMostActiveDay = getMostActiveDay(friendDayStats);
            const overallMostActiveDay = userDayStats[userMostActiveDay] > friendDayStats[friendMostActiveDay] ? userMostActiveDay : friendMostActiveDay;
            
            // Update the new insight elements
            document.getElementById('mostActiveTime').textContent = overallMostActiveTime;
            document.getElementById('userActiveTime').textContent = userMostActiveTime;
            document.getElementById('friendActiveTime').textContent = friendMostActiveTime;
            
            document.getElementById('mostActiveDay').textContent = overallMostActiveDay;
            document.getElementById('userActiveDay').textContent = userMostActiveDay;
            document.getElementById('friendActiveDay').textContent = friendMostActiveDay;
            
            document.getElementById('favoriteEmoji').textContent = favoriteEmoji;
            document.getElementById('userFavoriteEmoji').textContent = userFavoriteEmoji;
            document.getElementById('friendFavoriteEmoji').textContent = friendFavoriteEmoji;
            
            document.getElementById('userLongestStreak').textContent = myMsgs;
            document.getElementById('friendLongestStreak').textContent = friendMsgs;
        }

        function updateSummaryStats() {
            // This function updates the summary card at the top of the overview tab
            const totalMsgs = myMsgs + friendMsgs;
            const uniqueDates = [...new Set(messageDates)];
            const totalDays = uniqueDates.length;
            const avgMessages = totalMsgs / totalDays;
            
            document.getElementById('totalDays').textContent = totalDays;
            document.getElementById('avgMessages').textContent = avgMessages.toFixed(1);
            
            // Determine chat level based on message count
            let chatLevel = "New";
            if (totalMsgs > 1000) chatLevel = "Active";
            if (totalMsgs > 5000) chatLevel = "Very Active";
            if (totalMsgs > 10000) chatLevel = "Super Active";
            
            document.getElementById('chatLevel').textContent = chatLevel;
        }

        function generateWordCloud() {
            const canvas = document.getElementById('wordcloud-canvas');
            canvas.width = canvas.parentElement.offsetWidth;
            canvas.height = canvas.parentElement.offsetHeight;
            
            // Combine words from both users
            const allWords = [...myWordList, ...friendWordList];
            
            // Count word frequency
            const wordCount = {};
            allWords.forEach(word => {
                wordCount[word] = (wordCount[word] || 0) + 1;
            });
            
            // Convert to array for wordcloud
            const wordList = Object.entries(wordCount).map(([text, size]) => [text, size * 5]);
            
            // Generate word cloud
            WordCloud(canvas, {
                list: wordList,
                gridSize: Math.round((16 * canvas.width) / 1024),
                weightFactor: function(size) {
                    return Math.pow(size, 2.3) * canvas.width / 1024;
                },
                fontFamily: 'Segoe UI, system-ui, sans-serif',
                color: function() {
                    return ['#128C7E', '#25D366', '#075E54', '#34B7F1', '#FFC107'][Math.floor(Math.random() * 5)];
                },
                rotateRatio: 0.5,
                rotationSteps: 2,
                backgroundColor: '#ffffff'
            });
        }

        function exportToPDF() {
            // Show loading state for PDF generation
            document.getElementById("loadingSection").style.display = "block";
            
            // Use html2canvas and jsPDF to export results as PDF
            const { jsPDF } = window.jspdf;
            
            // Create a new PDF document
            const pdf = new jsPDF('p', 'mm', 'a4');
            let currentPage = 1;
            
            // Capture each tab and add as a page to the PDF
            const tabButtons = document.querySelectorAll('.tab-btn');
            const capturePromises = [];
            
            // Function to capture a tab
            const captureTab = (tabId, index) => {
                return new Promise((resolve) => {
                    // Activate the tab
                    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                    
                    document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
                    document.getElementById(`${tabId}Tab`).classList.add('active');
                    
                    // Wait for the tab to render
                    setTimeout(() => {
                        // Capture the tab content
                        html2canvas(document.getElementById(`${tabId}Tab`), {
                            scale: 2,
                            useCORS: true,
                            logging: false
                        }).then(canvas => {
                            const imgData = canvas.toDataURL('image/png', 1.0);
                            const imgWidth = pdf.internal.pageSize.getWidth();
                            const imgHeight = (canvas.height * imgWidth) / canvas.width;
                            
                            if (index > 0) {
                                pdf.addPage();
                            }
                            
                            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
                            
                            // Add page number
                            pdf.setFontSize(10);
                            pdf.text(`Page ${currentPage}`, imgWidth / 2, imgHeight - 10, { align: 'center' });
                            currentPage++;
                            
                            resolve();
                        });
                    }, 500);
                });
            };
            
            // Capture all tabs in sequence
            const captureAllTabs = async () => {
                for (let i = 0; i < tabButtons.length; i++) {
                    const tabId = tabButtons[i].getAttribute('data-tab');
                    await captureTab(tabId, i);
                }
                
                // Save the PDF
                pdf.save('WhatsApp-Chat-Analysis-Report.pdf');
                
                // Reactivate the original tab
                document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                
                document.querySelector('.tab-btn[data-tab="overview"]').classList.add('active');
                document.getElementById('overviewTab').classList.add('active');
                
                // Hide loading state
                document.getElementById("loadingSection").style.display = "none";
            };
            
            // Start capturing tabs
            captureAllTabs();
        }

        function exportWordCloud() {
            const canvas = document.getElementById('wordcloud-canvas');
            const link = document.createElement('a');
            link.download = 'WhatsApp-Word-Cloud.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        }

        function startNewAnalysis() {
            document.getElementById("myNameInput").value = "";
            document.getElementById("friendNameInput").value = "";
            document.getElementById("fileInput").value = "";
            document.getElementById("fileInputText").textContent = "Select exported WhatsApp chat (.txt)";
            document.getElementById("inputSection").style.display = "block";
            document.getElementById("resultsSection").style.display = "none";
            document.getElementById("loadingSection").style.display = "none";
        }