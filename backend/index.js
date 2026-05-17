const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const Groq = require("groq-sdk");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Supabase admin client
// We use the SERVICE_ROLE key here so this backend can insert OTPs
// and bypass RLS to force sign users into auth.users if needed
const supabaseUrl = process.env.SUPABASE_URL || "https://pyeckxqaowusxcmeuolk.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZWNreHFhb3d1c3hjbWV1b2xrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY1MzQ0MiwiZXhwIjoyMDg5MjI5NDQyfQ.cDPqfbnsriANJ1pGSnkdmsw5BWUuHxQP5_Fxv2Sdrbg";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Nodemailer SMTP setup
// In production, use your actual Gmail App Password inside .env
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER || "erijiao18@gmail.com",
        pass: process.env.EMAIL_PASS || "pckf eagz vaik nqf",
    },
});

app.post("/auth/send-otp", async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: "Email is required" });
    }

    try {
        // Generate a 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // Expire time (e.g. 5 mins) can be evaluated dynamically, 
        // but for now we'll just upsert it into an 'otps' table matching the email.
        const { error: dbError } = await supabase
            .from("otps")
            .upsert({ email, code, created_at: new Date() }, { onConflict: "email" });

        if (dbError) throw dbError;

        // Send Email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Your ConnectEd Login Code",
            text: `Your login code is: ${code}. It will expire shortly.`,
            html: `<h3>Welcome to ConnectEd!</h3>
                   <p>Your login code is: <strong>${code}</strong></p>
                   <p>Please enter this code in the app to continue.</p>`,
        };

        await transporter.sendMail(mailOptions);

        return res.status(200).json({ success: true, message: "OTP sent" });
    } catch (error) {
        console.error("Error sending OTP:", error);
        return res.status(500).json({ error: "Failed to send OTP", details: error.message });
    }
});

app.post("/auth/verify-otp", async (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
        return res.status(400).json({ error: "Email and code are required" });
    }

    try {
        // 1. Verify code matches DB
        const { data: storedOtp, error: selectError } = await supabase
            .from("otps")
            .select("code")
            .eq("email", email)
            .single();

        if (selectError || !storedOtp || storedOtp.code !== code) {
            return res.status(401).json({ error: "Invalid or expired code" });
        }

        // 2. Clear OTP so it can't be reused
        await supabase.from("otps").delete().eq("email", email);

        // 3. Find or Create User mathematically generating a temp password
        // This password is required to hit `signInWithPassword` to issue a real session
        const tempPassword = "Temp_OTP_Session_" + Math.random().toString(36).slice(-8);

        // Determine user role based on specific rules or email content
        let userRole = 'student';
        const lowerEmail = email.toLowerCase();
        
        if (lowerEmail === 'erijiao18@gmail.com') {
            userRole = 'teacher';
        } else if (lowerEmail === 'euriqt214@gmail.com') {
            userRole = 'student';
        } else if (lowerEmail.includes('teacher')) {
            userRole = 'teacher';
        }

        // First check if user exists via Admin API using ID
        let userId;
        const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
        const existingUser = usersData?.users.find((u) => u.email === email);

        if (existingUser) {
            userId = existingUser.id;
            // Update password temporarily to securely mint session token next, and enforce role
            await supabase.auth.admin.updateUserById(userId, { 
                password: tempPassword,
                user_metadata: { role: userRole }
            });
        } else {
            // Create user for the first time
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email: email,
                password: tempPassword,
                email_confirm: true,
                user_metadata: { role: userRole }
            });
            if (createError) throw createError;
            userId = newUser.user.id;
        }

        // 4. Securely mint a valid session JWT utilizing regular signInWithPassword targeting the tempPassword
        const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password: tempPassword,
        });

        if (signInError) throw signInError;

        return res.status(200).json({
            success: true,
            session: sessionData.session,
            user: sessionData.user,
        });

    } catch (error) {
        console.error("Error verifying OTP:", error);
        return res.status(500).json({ error: "Failed to verify OTP", details: error.message });
    }
});

app.post("/auth/direct-login", async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: "Email is required" });
    }

    try {
        const tempPassword = "Temp_OTP_Session_" + Math.random().toString(36).slice(-8);

        let userRole = 'student';
        const lowerEmail = email.toLowerCase();
        
        if (lowerEmail === 'erijiao18@gmail.com') {
            userRole = 'teacher';
        } else if (lowerEmail === 'euriqt214@gmail.com') {
            userRole = 'student';
        } else if (lowerEmail.includes('teacher')) {
            userRole = 'teacher';
        }

        let userId;
        const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
        const existingUser = usersData?.users.find((u) => u.email === email);

        if (existingUser) {
            userId = existingUser.id;
            await supabase.auth.admin.updateUserById(userId, { 
                password: tempPassword,
                user_metadata: { role: userRole }
            });
        } else {
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email: email,
                password: tempPassword,
                email_confirm: true,
                user_metadata: { role: userRole }
            });
            if (createError) throw createError;
            userId = newUser.user.id;
        }

        const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password: tempPassword,
        });

        if (signInError) throw signInError;

        return res.status(200).json({
            success: true,
            session: sessionData.session,
            user: sessionData.user,
        });

    } catch (error) {
        console.error("Error direct login:", error);
        return res.status(500).json({ error: "Failed to login", details: error.message });
    }
});

app.post("/auth/register", async (req, res) => {
    const { email, password, role, firstName, lastName, middleName, year, section, course, status, phone } = req.body;

    console.log("\n--- [Register] New Request ---");
    console.log(`Email: ${email}`);
    console.log(`Role: ${role}`);
    console.log(`Name: ${firstName} ${lastName}`);

    if (!email || !password || !firstName || !lastName || !role) {
        console.error("❌ [Register] Missing required fields");
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const normalizedEmail = email.toLowerCase().trim();
        let userId;

        // 1. Create User in Supabase Auth
        console.log(`[Register] 1/3: Creating user in Supabase Auth...`);
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: normalizedEmail,
            password,
            email_confirm: true,
            user_metadata: { 
                role,
                firstName,
                lastName,
                middleName,
                year,
                section,
                course,
                phone,
                is_verified: true 
            }
        });

        if (createError) {
            console.log(`[Register] Auth creation note: ${createError.message} (Code: ${createError.code})`);
            if (createError.message.includes("already registered") || createError.code === 'email_exists') {
                console.log(`[Register] User already exists in Auth. Fetching ID...`);
                const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
                if (usersError) {
                    console.error("❌ [Register] listUsers failed:", usersError.message);
                    throw usersError;
                }
                const existingUser = usersData?.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
                if (!existingUser) {
                    console.error("❌ [Register] User reported exists but not found in list.");
                    throw new Error("User exists in Auth but lookup failed.");
                }
                userId = existingUser.id;
            } else {
                console.error("❌ [Register] Auth creation FAILED:", createError.message);
                throw createError;
            }
        } else {
            userId = newUser?.user?.id;
            console.log(`✅ [Register] Auth User Created: ${userId}`);
        }

        // 2. Insert/Update public.profiles
        console.log(`[Register] 2/3: Upserting profile into database...`);
        const profileData = {
            id: userId,
            email: normalizedEmail,
            first_name: firstName,
            last_name: lastName,
            middle_name: middleName,
            role: role,
            year_level: String(year || ""),
            section: section || "",
            course: course || "",
            phone: phone || "",
            status: status || "Active",
            is_verified: true,
            updated_at: new Date().toISOString()
        };

        const { error: profileError } = await supabase.from("profiles").upsert(profileData);

        if (profileError) {
            console.error("❌ [Register] Profile upsert FAILED:", profileError.message);
            throw profileError;
        }
        console.log("✅ [Register] Profile record upserted.");

        // 3. Email sending disabled temporarily as requested
        console.log(`[Register] 3/3: Email sending skipped (alternative mode).`);

        console.log("🏁 [Register] SUCCESS!\n");
        return res.status(200).json({ success: true, message: "Registration successful.", userId });

    } catch (error) {
        console.error("❌ [Register] FATAL ERROR:", error.message);
        return res.status(500).json({ error: "Registration failed", details: error.message });
    }
});

// Initialize Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "gsk_replace_me_with_actual_key" });

app.post("/api/chat", async (req, res) => {
    const { messages, role = 'student' } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages are required and must be an array" });
    }

    try {
        const studentPrompt = `
You are an AI Learning Coach integrated into a Learning Management System (LMS).
Your primary role is to GUIDE students to learn, NOT to give direct answers.
CORE RULES:
- Never give final answers immediately
- Always guide step-by-step
- Ask questions first
- Provide hints before solutions
STYLE: Clear, simple, interactive, encouraging.
        `;

        const teacherPrompt = `
You are an AI Teaching Assistant integrated into a Learning Management System (LMS).
Your primary role is to help teachers with academic tasks.
CAPABILITIES:
- Activities and quizzes from class materials
- Lesson plans in DepEd DLL format
- Rubrics and assessment tools
- Summaries of uploaded materials
- Parent communication letters
- Filipino/English translations
STYLE: Professional, efficient, helpful, educational expert.
        `;

        const systemPrompt = role === 'teacher' ? teacherPrompt : studentPrompt;

        const response = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                ...messages
            ],
            model: "qwen-2.5-32b", 
            temperature: 0.7,
            max_tokens: 1500,
        });

        const aiMessage = response.choices[0]?.message?.content || "I'm sorry, I couldn't process that.";
        return res.status(200).json({ reply: aiMessage });
    } catch (error) {
        console.error("Groq API Error:", error);
        return res.status(500).json({ error: "Failed to communicate with AI Assistant" });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let localIp = 'localhost';
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                localIp = iface.address;
                break;
            }
        }
    }
    console.log(`\n=================================================`);
    console.log(`Backend Server is RUNNING`);
    console.log(`Local:   http://localhost:${PORT}`);
    console.log(`Network: http://${localIp}:${PORT}`);
    console.log(`=================================================\n`);
});
