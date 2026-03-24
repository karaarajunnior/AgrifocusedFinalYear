import express from "express";
import { handleUSSDRequest } from "../services/ussdService.js";

const router = express.Router();

/**
 * POST /api/ussd
 * Simulates a USSD callback from a telecom provider
 * Body: { msisdn: string, text: string, sessionId: string }
 */
router.post("/", async (req, res) => {
    const { msisdn, text, sessionId } = req.body;
    
    if (!msisdn || sessionId === undefined) {
        return res.status(400).send("Bad Request: Missing parameters");
    }

    try {
        const response = await handleUSSDRequest(msisdn, text || "", sessionId);
        res.send(response);
    } catch (error) {
        console.error("USSD Error:", error);
        res.status(500).send("END System error. Please try again later.");
    }
});

export default router;
