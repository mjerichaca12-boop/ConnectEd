const nodemailer = require("nodemailer");
require("dotenv").config();

async function testEmail() {
    console.log("Testing email credentials...");
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER || "erijiao18@gmail.com",
            pass: process.env.EMAIL_PASS || "pckf eagz vaik nqf",
        },
    });

    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_USER || "erijiao18@gmail.com",
            to: "erijiao18@gmail.com", // Send to self
            subject: "ConnectEd System Test",
            text: "If you receive this, the email system is working correctly."
        });
        console.log("✅ Email sent successfully:", info.response);
    } catch (error) {
        console.error("❌ Failed to send email:");
        console.error(error);
    }
}

testEmail();
