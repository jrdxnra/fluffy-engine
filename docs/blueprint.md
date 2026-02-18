# **App Name**: SBDOH 5/3/1 Control

## Core Features:

- Global Cycle Management: Admin can centrally adjust the current workout cycle phase (Week 1, Week 2, etc.) or custom percentages and rep targets, applying changes instantly across all client workouts.
- Client & Training Max Roster: An interface to add new clients, input their 1-Rep Maxes (1RMs), and automatically calculate and store their 90% Training Maxes for various lifts. Existing client data can also be viewed.
- Dynamic Workout Calculation: Automatically calculate detailed warm-up sets (50%, 60%), working sets (based on global percentages), and target reps, applying the 'mround' logic (rounding to the nearest 5 lbs) as specified. Formula Order of Operations: (TM * Percentage) -> Round Result to nearest 5.
- Personalized Workout Display: Generate and display a clear, tabular view of individual and team workouts based on the selected lift, showing warm-ups, work sets, and PR goals for each client. UI Feature: Next to the calculated weight (e.g., 215 lbs), display the specific plate loading required (e.g., '45, 35, 5').
- Data Persistence (Firebase): Securely store and retrieve all client information, their 1RM and Training Maxes, and the defined cycle settings using a Firebase database.
- Workout Data Export: Enable the Admin to download the currently displayed workout data for the team as a CSV file for record-keeping and external use.
- AI-Powered Progress Insights Tool: A generative AI tool that, based on current workout parameters and a client's stored historical performance data, provides personalized insights or strategic tips to enhance training and guide future cycle planning. The AI tool will use reasoning.
- Rep Record Input & Logger: Add a simple input field next to the 'Top Set' (Work Set 3) where the lifter types in the number of reps they actually achieved. Input: Reps performed. System stores: {Date, Lift, Weight, Reps, Estimated_1RM}.
- Cycle Graduation Automation (The 5/10lb Rule): A 'Graduate Team' button for the Admin. When clicked, it takes the current Training Maxes for everyone on the roster and mathematically adds +5 lbs to Bench/Press and +10 lbs to Squat/Deadlift. Logic: New_TM = Old_TM + Increment. Do not recalculate TMs based on recent 1RM performance unless explicitly overridden by Admin. Specify that this increase applies to the Training Max (TM), not the 1RM.
- PR Target Calculator (Gamification): The app should dynamically calculate: 'To beat your estimated 1RM from last month, you need to hit X reps at today's weight.'
- Daily Accessory & Conditioning Display: A static section below the main math that displays the day's prescribed accessory work based on your 2-Day Split tab (e.g., 'Today's Accessories: Lat Pulldowns 3x10, Hanging Leg Raises 3x15'). Logic Map: If Main Lift = Deadlift OR Bench, Display: 'Vertical Pull / Core'. If Main Lift = Squat OR Press, Display: 'Dumbbell Rows / Single Leg'. Include a static 'Conditioning' reminder on all days.

## Style Guidelines:

- Dark Charcoal background, White text for numbers, and a 'Signal Color' (like Neon Blue or Green) for the Top Set row to draw the eye immediately.
- Ensure the Numbers (weights) are Monospaced (like 'Roboto Mono' or 'JetBrains Mono') so columns align perfectly in the tables. 'Inter' is perfect.
- Use minimalist, line-art style icons. Prioritize icons that directly relate to weightlifting (e.g., barbell, dumbbell, specific lift movements) and clear, intuitive icons for user interface actions like add, settings, and download. Icons should complement the modern, functional aesthetic.
- The layout will adopt a 'command center' approach with a clear distinction between global settings (e.g., in a left-hand sidebar or top panel) and the main content area. Data will be primarily displayed in well-structured, easy-to-scan tables, optimizing for quick information absorption. Client input forms will be collapsible to maintain a clean workspace.
- Incorporate subtle and functional animations. Examples include smooth transitions when global settings are updated and the workout data re-calculates, clear loading indicators for data fetches, and gentle feedback on button presses or form submissions. Animations should enhance user understanding and responsiveness without being distracting.