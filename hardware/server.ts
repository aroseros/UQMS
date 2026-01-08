import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } from 'node-thermal-printer';

/**
 * Hardware Abstraction Layer
 * Allows swapping distinct hardware implementations easily.
 */
interface IHardwareDevice {
    printTicket(ticketNumber: string, metadata: any): Promise<void>;
}

/**
 * Concrete Implementation: Thermal Printer
 */
class ThermalPrinterAdapter implements IHardwareDevice {
    private printer: ThermalPrinter;

    constructor() {
        this.printer = new ThermalPrinter({
            type: PrinterTypes.EPSON, // Adjust based on actual hardware
            interface: 'printer:auto', // Auto-detect on Linux/Mac, or 'tcp://xxx'
            characterSet: CharacterSet.PC852_LATIN2,
            removeSpecialCharacters: false,
            breakLine: BreakLine.WORD,
            options: {
                timeout: 5000
            }
        });
    }

    async printTicket(ticketNumber: string, metadata: any): Promise<void> {
        const isConnected = await this.printer.isPrinterConnected();
        if (!isConnected) {
            console.warn('Printer not connected. Skipping print job.');
            return;
        }

        this.printer.alignCenter();
        this.printer.println("UNIVERSITY QUEUE");
        this.printer.drawLine();
        this.printer.setTextSize(2, 2);
        this.printer.println(ticketNumber);
        this.printer.setTextSize(1, 1);
        this.printer.println(new Date().toLocaleString());
        if (metadata?.faculty) {
            this.printer.println(`Faculty: ${metadata.faculty}`);
        }
        this.printer.cut();

        try {
            await this.printer.execute();
            console.log(`Printed ticket: ${ticketNumber}`);
            this.printer.clear();
        } catch (error) {
            console.error('Print error:', error);
        }
    }
}

/**
 * Concrete Implementation: Mock Device (for development without hardware)
 */
class MockDeviceAdapter implements IHardwareDevice {
    async printTicket(ticketNumber: string, metadata: any): Promise<void> {
        console.log(`[MOCK PRINT] -------------------------`);
        console.log(`[MOCK PRINT] Ticket: ${ticketNumber}`);
        console.log(`[MOCK PRINT] Time:   ${new Date().toLocaleString()}`);
        console.log(`[MOCK PRINT] Meta:   ${JSON.stringify(metadata)}`);
        console.log(`[MOCK PRINT] -------------------------`);
    }
}

// Factory to choose device based on Env
const getHardwareDevice = (): IHardwareDevice => {
    // Use real printer if explicitly enabled or in production
    if (process.env.PRINTER_ENABLED === 'true' || process.env.NODE_ENV === 'production') {
        console.log('🔌 Using Real Thermal Printer');
        return new ThermalPrinterAdapter();
    }
    console.log('👻 Using Mock Printer (Simulation)');
    return new MockDeviceAdapter();
};

const device = getHardwareDevice();
const server = Fastify({ logger: true });

// Enable CORS for Vercel App
server.register(cors, {
    origin: ['http://localhost:3000', 'https://your-vercel-app.vercel.app'],
    methods: ['POST']
});

// Route: Print Ticket
server.post('/print', async (request, reply) => {
    const { ticket_number, metadata } = request.body as { ticket_number: string, metadata: any };

    if (!ticket_number) {
        return reply.code(400).send({ error: 'ticket_number is required' });
    }

    try {
        await device.printTicket(ticket_number, metadata);
        return { success: true };
    } catch (err) {
        request.log.error(err);
        return reply.code(500).send({ error: 'Failed to print ticket' });
    }
});

// Start Server
const start = async () => {
    try {
        await server.listen({ port: 8080, host: '0.0.0.0' });
        console.log('Hardware Bridge running on http://localhost:8080');
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();
