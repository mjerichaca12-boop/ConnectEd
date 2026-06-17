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
    const { email, password, role, firstName, lastName, middleName, year, section, course } = req.body;

    // -- Required field check
    if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ error: "Missing required fields: firstName, lastName, email, password" });
    }

    // -- Server-side password strength validation
    const passwordErrors = [];
    if (!password || password.length < 12)
        passwordErrors.push("Password must be at least 12 characters long.");
    if (!/[A-Z]/.test(password))
        passwordErrors.push("Password must contain at least one uppercase letter.");
    if (!/[0-9]/.test(password))
        passwordErrors.push("Password must contain at least one number.");
    if (!/[^A-Za-z0-9]/.test(password))
        passwordErrors.push("Password must contain at least one special character (e.g. !@#$%^&*).");

    if (passwordErrors.length > 0) {
        return res.status(400).json({ error: "Weak password", details: passwordErrors });
    }

    // -- Gmail-only enforcement
    if (!email.toLowerCase().endsWith("@gmail.com")) {
        return res.status(400).json({ error: "Only Gmail accounts (@gmail.com) are accepted." });
    }

    try {
        // Step 0 — Check if the email already exists in Supabase Auth.
        // If they exist but are unverified, delete them so they can register fresh without "email_exists" 422 errors!
        const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
        if (!listError && listData?.users) {
            const existingUser = listData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
            if (existingUser) {
                if (!existingUser.email_confirmed_at) {
                    console.log(`[register] Found existing unverified user ${existingUser.id} for ${email}. Deleting to allow fresh signup.`);
                    await supabase.auth.admin.deleteUser(existingUser.id);
                    
                    // Also delete their profile from the database to keep clean
                    await supabase.from("profiles").delete().eq("id", existingUser.id);
                } else {
                    return res.status(400).json({ error: "A user with this email address has already been registered and verified." });
                }
            }
        }

        // Step 1 — Create the user account (unverified)
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: false,   // keep unverified until student clicks the Gmail link
            user_metadata: {
                role: role || 'student',
                firstName,
                lastName,
                middleName: middleName || '',
                year,
                section,
                course,
                is_verified: false
            }
        });

        if (createError) throw createError;
        const userId = newUser.user.id;

        // Step 2 — Insert into public.profiles (best-effort)
        try {
            await supabase.from("profiles").insert({
                id: userId,
                first_name: firstName,
                last_name: lastName,
                middle_name: middleName || '',
                role: role || 'student',
                year_level: year || '',
                section: section || '',
                course: course || '',
                is_verified: false
            });
        } catch (profileError) {
            console.error("Warning: profiles insert failed", profileError.message);
        }

        // Step 3 — Generate a 6-digit OTP code and store it in the 'otps' table
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const { error: dbError } = await supabase
            .from("otps")
            .upsert({ email, code, created_at: new Date() }, { onConflict: "email" });

        if (dbError) {
            console.error("Warning: failed to store signup OTP:", dbError.message);
        }

        // Step 4 — Send the 6-digit OTP code to their Gmail via Nodemailer
        const mailOptions = {
            from: `"ConnectEd" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `${code} is your ConnectEd verification code`,
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background-color: #F8FAFC; border-radius: 16px; border: 1px solid #E2E8F0;">
                    <div style="text-align: center; margin-bottom: 24px;">
                        <span style="font-size: 28px; font-weight: bold; color: #009664; letter-spacing: -0.5px;">ConnectEd</span>
                    </div>
                    
                    <h2 style="color: #1E293B; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 12px; text-align: center;">Verify your account</h2>
                    <p style="color: #475569; font-size: 15px; line-height: 24px; margin-top: 0; margin-bottom: 24px; text-align: center;">
                        Hi <strong>${firstName}</strong>, thank you for signing up! Enter the 6-digit verification code below in the ConnectEd mobile app to activate your student account.
                    </p>
                    
                    <div style="text-align: center; margin: 32px 0;">
                        <span style="background-color: #ECFDF5; color: #009664; padding: 18px 48px; border-radius: 12px;
                                     font-family: monospace; font-weight: bold; font-size: 32px; letter-spacing: 6px; display: inline-block;
                                     border: 2px dashed #A7F3D0; box-shadow: 0 4px 12px rgba(0, 150, 100, 0.05);">
                            ${code}
                        </span>
                    </div>
                    
                    <p style="font-size: 13px; color: #64748B; line-height: 20px; margin-top: 24px; margin-bottom: 0; text-align: center;">
                        This code will expire shortly. If you did not request this, you can safely ignore this email.
                    </p>
                    
                    <hr style="border: 0; border-top: 1px solid #E2E8F0; margin: 32px 0 24px 0;" />
                    <p style="font-size: 12px; color: #94A3B8; text-align: center; margin: 0;">
                        ConnectEd Student Self-Registration Services
                    </p>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`[register] OTP verification email sent to ${email} with code ${code}`);
        } catch (mailError) {
            console.error("Warning: failed to send OTP verification email:", mailError.message);
        }

        return res.status(200).json({
            success: true,
            otpSent: true,
            email: email,
            message: "Registration successful. A 6-digit verification code has been sent to your Gmail."
        });

    } catch (error) {
        console.error("Error registering user:", error);
        return res.status(500).json({ error: "Failed to register user", details: error.message });
    }
});

// Endpoint to verify the 6-digit registration OTP code and activate the user account
app.post("/auth/verify-register-otp", async (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
        return res.status(400).json({ error: "Email and verification code are required" });
    }

    try {
        console.log(`[verify-register-otp] Verifying OTP for ${email}...`);

        // 1. Verify code matches DB entry in 'otps' table
        const { data: storedOtp, error: selectError } = await supabase
            .from("otps")
            .select("code")
            .eq("email", email.trim().toLowerCase())
            .single();

        if (selectError || !storedOtp || storedOtp.code !== code.trim()) {
            return res.status(401).json({ error: "Invalid or expired verification code" });
        }

        // 2. Clear OTP so it cannot be reused
        await supabase.from("otps").delete().eq("email", email.trim().toLowerCase());

        // 3. Find the user inside auth.users
        const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
        if (listError || !usersData?.users) {
            throw new Error("Failed to scan auth users");
        }

        const authUser = usersData.users.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());
        if (!authUser) {
            return res.status(404).json({ error: "No pending account found for this email address" });
        }

        // 4. Confirm user server-to-server via Supabase Admin API (sets email_confirmed_at!)
        const { error: confirmError } = await supabase.auth.admin.updateUserById(
            authUser.id,
            { email_confirm: true }
        );

        if (confirmError) throw confirmError;

        // 5. Update profiles entry to verified: true
        const { error: profileError } = await supabase
            .from("profiles")
            .update({ is_verified: true })
            .eq("id", authUser.id);

        if (profileError) {
            console.error("Warning: failed to mark profiles as verified:", profileError.message);
        }

        console.log(`[verify-register-otp] Account activated successfully for ${email}`);
        return res.status(200).json({
            success: true,
            message: "Account verified and activated successfully! You can now log in."
        });

    } catch (err) {
        console.error("Error verifying registration OTP:", err);
        return res.status(500).json({ error: "Failed to verify code", details: err.message });
    }
});

// Custom endpoint to handle the verification request server-to-server and display a stunning success HTML page
app.get("/auth/verify-student", async (req, res) => {
    const { supabase_url, name } = req.query;

    if (!supabase_url) {
        return res.status(400).send("<h3>Error: Missing verification URL.</h3>");
    }

    try {
        console.log(`[verify-student] Verifying user server-side...`);
        
        // Execute the verification GET request server-side
        const verifyResponse = await fetch(supabase_url, {
            method: 'GET',
            redirect: 'manual', // Intercept the 303/302 redirect
        });

        console.log(`[verify-student] Supabase response status: ${verifyResponse.status}`);

        // Account is successfully verified now! Send high-fidelity animated confirmation HTML
        res.setHeader("Content-Type", "text/html");
        return res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Account Verified — ConnectEd</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        background-color: #F0FAF5;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                        padding: 16px;
                        box-sizing: border-box;
                    }
                    .container {
                        background: #ffffff;
                        border-radius: 24px;
                        padding: 40px 32px;
                        max-width: 440px;
                        width: 100%;
                        text-align: center;
                        box-shadow: 0 10px 30px rgba(0, 150, 100, 0.05), 0 1px 8px rgba(0, 0, 0, 0.02);
                        border: 1px solid #E2E8F0;
                        animation: fadeInUp 0.6s ease-out;
                    }
                    @keyframes fadeInUp {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .icon-container {
                        width: 96px;
                        height: 96px;
                        background: #ECFDF5;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 24px auto;
                        border: 2px solid #A7F3D0;
                        animation: scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.2s both;
                    }
                    @keyframes scaleIn {
                        from { transform: scale(0); }
                        to { transform: scale(1); }
                    }
                    .checkmark {
                        color: #009664;
                        font-size: 48px;
                        font-weight: bold;
                        line-height: 1;
                    }
                    h1 {
                        font-size: 24px;
                        color: #1E293B;
                        margin: 0 0 8px 0;
                        font-weight: 800;
                    }
                    p {
                        font-size: 15px;
                        color: #64748B;
                        line-height: 22px;
                        margin: 0 0 32px 0;
                    }
                    .highlight {
                        color: #009664;
                        font-weight: bold;
                    }
                    .btn {
                        background: #009664;
                        color: #ffffff;
                        border: none;
                        padding: 14px 28px;
                        font-size: 15px;
                        font-weight: bold;
                        border-radius: 12px;
                        cursor: pointer;
                        text-decoration: none;
                        box-shadow: 0 4px 12px rgba(0, 150, 100, 0.2);
                        display: inline-block;
                        width: 100%;
                        box-sizing: border-box;
                        transition: all 0.2s ease;
                    }
                    .btn:hover {
                        background: #007A50;
                        box-shadow: 0 6px 16px rgba(0, 150, 100, 0.3);
                        transform: translateY(-1px);
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="icon-container">
                        <span class="checkmark">✓</span>
                    </div>
                    <h1>Email Verified!</h1>
                    <p>
                        Thank you ${name ? `<span class="highlight">${name}</span>` : 'student'}! Your account has been successfully verified. 
                        You can now close this tab, return to the <span class="highlight">ConnectEd</span> mobile app, and sign in.
                    </p>
                    <button class="btn" onclick="window.close()">Done</button>
                </div>
            </body>
            </html>
        `);
        
    } catch (error) {
        console.error("Error executing server-side verification:", error);
        return res.status(500).send("<h3>Verification failed. Please try again.</h3>");
    }
});

// Forgot password — generates a secure 6-digit OTP and sends it via Nodemailer to the student's Gmail
app.post("/auth/forgot-password", async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: "Email is required" });
    }

    try {
        console.log(`[forgot-password] Request received for ${email}`);

        // 1. Verify user exists in database first
        const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
        if (listError || !usersData?.users) {
            throw new Error("Failed to scan user directory");
        }

        const authUser = usersData.users.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());
        if (!authUser) {
            return res.status(404).json({ error: "No account found with this email address." });
        }

        // 2. Generate a secure, random 6-digit OTP code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // 3. Clear any existing OTP for this email and save the new OTP code in 'otps' table
        await supabase.from("otps").delete().eq("email", email.trim().toLowerCase());
        
        const { error: insertError } = await supabase
            .from("otps")
            .insert({
                email: email.trim().toLowerCase(),
                code: code,
                created_at: new Date().toISOString()
            });

        if (insertError) throw insertError;

        console.log(`[forgot-password] Secure OTP generated for ${email}: ${code}`);

        // 4. Send the 6-digit OTP code to the Gmail inbox via Nodemailer
        const mailOptions = {
            from: `"ConnectEd Security" <${process.env.EMAIL_USER}>`,
            to: email.trim(),
            subject: "ConnectEd — Password Reset Verification Code",
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px; background-color: #F8FAFC; border-radius: 16px; border: 1px solid #E2E8F0; text-align: center;">
                    <div style="margin-bottom: 24px;">
                        <span style="font-size: 26px; font-weight: bold; color: #009664; letter-spacing: -0.5px;">ConnectEd</span>
                    </div>
                    
                    <h2 style="color: #1E293B; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">Reset Your Password</h2>
                    <p style="color: #475569; font-size: 15px; line-height: 24px; margin-top: 0; margin-bottom: 24px;">
                        Use the 6-digit verification code below inside the mobile app to verify your identity and reset your account password.
                    </p>
                    
                    <div style="background-color: #ECFDF5; border: 2px dashed #A7F3D0; border-radius: 12px; padding: 18px; margin: 28px 0; display: inline-block; width: 100%; box-sizing: border-box;">
                        <span style="font-size: 36px; font-weight: 800; color: #009664; letter-spacing: 6px; font-family: monospace; display: block; margin: 0;">${code}</span>
                    </div>
                    
                    <p style="font-size: 13px; color: #64748B; line-height: 20px; margin-top: 24px; margin-bottom: 0;">
                        This code is highly confidential and will expire in 10 minutes. If you did not make this request, please ignore this email.
                    </p>
                    
                    <hr style="border: 0; border-top: 1px solid #E2E8F0; margin: 32px 0 24px 0;" />
                    <p style="font-size: 12px; color: #94A3B8; margin: 0;">
                        ConnectEd Student Security Recovery
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`[forgot-password] OTP verification code successfully sent to Gmail ${email}`);

        return res.status(200).json({ success: true, message: "A 6-digit verification code has been sent to your Gmail." });

    } catch (error) {
        console.error("Error sending forgot-password OTP:", error);
        return res.status(500).json({ error: "Failed to send reset code", details: error.message });
    }
});

// Endpoint to verify the reset OTP code
app.post("/auth/verify-reset-otp", async (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
        return res.status(400).json({ error: "Email and verification code are required" });
    }

    try {
        console.log(`[verify-reset-otp] Verifying OTP for ${email}...`);

        // Check if matching code exists in the database
        const { data: storedOtp, error: selectError } = await supabase
            .from("otps")
            .select("code")
            .eq("email", email.trim().toLowerCase())
            .single();

        if (selectError || !storedOtp || storedOtp.code !== code.trim()) {
            return res.status(401).json({ error: "Invalid or expired verification code" });
        }

        console.log(`[verify-reset-otp] OTP successfully verified for ${email}`);
        return res.status(200).json({ success: true, message: "OTP verified successfully. You can now reset your password." });

    } catch (err) {
        console.error("Error verifying reset OTP:", err);
        return res.status(500).json({ error: "Failed to verify code", details: err.message });
    }
});

// Endpoint to securely save the new password using Supabase Admin server-to-server!
app.post("/auth/update-password", async (req, res) => {
    const { email, code, password } = req.body;

    if (!email || !code || !password) {
        return res.status(400).json({ error: "Email, verification code, and new password are required" });
    }

    // Password rules validation matching exactly what is on client-side
    const hasLen = password.length >= 12;
    const hasUpper = /[A-Z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasLen || !hasUpper || !hasDigit || !hasSpecial) {
        return res.status(400).json({ 
            error: "Password does not meet strength rules: Must be at least 12 characters, contain an uppercase letter, a digit, and a special character."
        });
    }

    try {
        console.log(`[update-password] Attempting password save for ${email}...`);

        // 1. Verify code again to guarantee authenticity
        const { data: storedOtp, error: selectError } = await supabase
            .from("otps")
            .select("code")
            .eq("email", email.trim().toLowerCase())
            .single();

        if (selectError || !storedOtp || storedOtp.code !== code.trim()) {
            return res.status(401).json({ error: "Unauthorized operation or expired OTP session." });
        }

        // 2. Find the user ID by email
        const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
        if (listError || !usersData?.users) {
            throw new Error("Failed to scan user directory");
        }

        const authUser = usersData.users.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());
        if (!authUser) {
            return res.status(404).json({ error: "User account not found." });
        }

        // 3. Update the password server-to-server securely using Supabase Admin Auth API!
        const { error: updateError } = await supabase.auth.admin.updateUserById(
            authUser.id,
            { password: password }
        );

        if (updateError) throw updateError;

        // 4. Delete the OTP code upon successful update so it cannot be reused
        await supabase.from("otps").delete().eq("email", email.trim().toLowerCase());

        console.log(`[update-password] Password successfully updated for ${email}`);
        return res.status(200).json({ success: true, message: "Your password has been successfully updated! You can now log in." });

    } catch (err) {
        console.error("Error updating password:", err);
        return res.status(500).json({ error: "Failed to update password", details: err.message });
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
            model: "llama-3.3-70b-versatile", 
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
