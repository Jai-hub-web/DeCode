import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import { Server } from 'socket.io';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PrismaClient } from '@prisma/client';
import archiver from 'archiver';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

// Optional: import Groq
import Groq from 'groq-sdk';
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

const app = Fastify({ logger: true });

app.register(fastifyCors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});



interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

function buildTreeFromPaths(files: { path: string; type: string }[]): FileNode[] {
  const root: FileNode[] = [];
  
  files.forEach(file => {
    const parts = file.path.split('/');
    let currentLevel = root;
    let currentPath = '';

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLast = index === parts.length - 1;
      
      let existingNode = currentLevel.find(n => n.name === part);
      
      if (!existingNode) {
        existingNode = {
          name: part,
          path: currentPath,
          type: isLast ? (file.type as 'file' | 'folder') : 'folder',
          ...(isLast && file.type === 'file' ? {} : { children: [] })
        };
        currentLevel.push(existingNode);
      }
      
      if (existingNode.children) {
        currentLevel = existingNode.children;
      }
    });
  });

  return root;
}

// --- Auth & Projects API ---

app.post('/api/login', async (request, reply) => {
  const { username } = request.body as { username: string };
  if (!username) return reply.status(400).send({ error: 'Username required' });
  
  try {
    const user = await prisma.user.upsert({
      where: { username },
      update: {},
      create: { username }
    });
    return reply.send({ user });
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Login failed' });
  }
});

app.get('/api/projects', async (request, reply) => {
  const { userId } = request.query as { userId: string };
  try {
    const projects = await prisma.project.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
    return reply.send({ projects });
  } catch (err) {
    return reply.status(500).send({ error: 'Failed to fetch projects' });
  }
});

app.post('/api/projects/new', async (request, reply) => {
  const { userId, name, language } = request.body as { userId: string; name: string; language: string };
  try {
    const project = await prisma.project.create({
      data: { userId, name, language }
    });
    return reply.send({ project });
  } catch (err) {
    return reply.status(500).send({ error: 'Failed to create project' });
  }
});

app.put('/api/projects/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const { name } = request.body as { name: string };
  if (!name || !name.trim()) return reply.status(400).send({ error: 'Name cannot be empty' });

  try {
    const project = await prisma.project.update({
      where: { id },
      data: { name: name.trim() }
    });
    return reply.send({ project });
  } catch (err) {
    return reply.status(500).send({ error: 'Failed to rename project' });
  }
});

app.get('/api/projects/:id/export', async (request, reply) => {
  const { id } = request.params as { id: string };

  try {
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const files = await prisma.file.findMany({ where: { projectId: id } });

    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    reply.header('Content-Type', 'application/zip');
    reply.header('Content-Disposition', `attachment; filename="${project.name}.zip"`);

    archive.on('error', err => {
      throw err;
    });

    for (const file of files) {
      if (file.type === 'folder') {
        archive.append('', { name: file.path + '/' });
      } else {
        archive.append(file.content || '', { name: file.path });
      }
    }

    archive.finalize();
    return reply.send(archive);

  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to export project' });
  }
});

// --- REST Endpoints for File CRUD ---

app.get('/api/files', async (request, reply) => {
  const { project: projectId } = request.query as { project?: string };
  if (!projectId) return reply.send({ files: [] });

  try {
    const dbFiles = await prisma.file.findMany({
      where: { projectId },
      select: { path: true, type: true },
      orderBy: { path: 'asc' }
    });
    const files = buildTreeFromPaths(dbFiles);
    return reply.send({ files });
  } catch (err) {
    return reply.send({ files: [] });
  }
});

app.post('/api/files/save', async (request, reply) => {
  const { filename, content, project: projectId } = request.body as { filename: string; content: string; project?: string };
  if (!projectId) return reply.status(400).send({ error: 'Project ID required' });
  
  try {
    // Save to DB
    await prisma.file.upsert({
      where: { projectId_path: { projectId, path: filename } },
      update: { content, type: 'file' },
      create: { projectId, path: filename, content, type: 'file' }
    });
    
    return reply.send({ status: 'success', message: 'File saved successfully.' });
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to save file.' });
  }
});

app.post('/api/files/folder', async (request, reply) => {
  const { foldername, project: projectId } = request.body as { foldername: string; project?: string };
  if (!projectId) return reply.status(400).send({ error: 'Project ID required' });
  
  try {
    // Save to DB
    await prisma.file.upsert({
      where: { projectId_path: { projectId, path: foldername } },
      update: { type: 'folder' },
      create: { projectId, path: foldername, type: 'folder' }
    });
    
    return reply.send({ status: 'success' });
  } catch (err) {
    return reply.status(500).send({ error: 'Failed to create folder.' });
  }
});

app.get('/api/files/*', async (request, reply) => {
  const filename = (request.params as any)['*'];
  const { project: projectId } = request.query as { project?: string };
  if (!projectId) return reply.status(400).send({ error: 'Project ID required' });

  try {
    const file = await prisma.file.findUnique({
      where: { projectId_path: { projectId, path: filename } }
    });
    if (file) {
      return reply.send({ content: file.content || '' });
    } else {
      return reply.status(404).send({ error: 'File not found.' });
    }
  } catch (err) {
    return reply.status(500).send({ error: 'Failed to read file.' });
  }
});

app.delete('/api/files/*', async (request, reply) => {
  const filename = (request.params as any)['*'];
  const { project: projectId } = request.query as { project?: string };
  if (!projectId) return reply.status(400).send({ error: 'Project ID required' });

  try {
    // Delete from DB (and any nested paths if it's a folder)
    await prisma.file.deleteMany({
      where: {
        projectId,
        OR: [
          { path: filename },
          { path: { startsWith: `${filename}/` } }
        ]
      }
    });
    
    return reply.send({ status: 'success' });
  } catch (err) {
    return reply.status(500).send({ error: 'Failed to delete file.' });
  }
});

app.put('/api/files/*', async (request, reply) => {
  const filename = (request.params as any)['*'];
  const { newFilename, project: projectId } = request.body as { newFilename: string; project?: string };
  if (!projectId) return reply.status(400).send({ error: 'Project ID required' });

  try {
    // Fetch file to rename
    const file = await prisma.file.findUnique({ where: { projectId_path: { projectId, path: filename } } });
    if (file) {
      // Update in DB
      await prisma.file.update({
        where: { id: file.id },
        data: { path: newFilename }
      });
      // Update any nested files if it was a folder
      if (file.type === 'folder') {
        const nestedFiles = await prisma.file.findMany({
          where: { projectId, path: { startsWith: `${filename}/` } }
        });
        for (const nested of nestedFiles) {
          const newPath = nested.path.replace(`${filename}/`, `${newFilename}/`);
          await prisma.file.update({
            where: { id: nested.id },
            data: { path: newPath }
          });
        }
      }
    }
    return reply.send({ status: 'success' });
  } catch (err) {
    return reply.status(500).send({ error: 'Failed to rename file.' });
  }
});

// Sync project files from DB to an ephemeral temp directory
async function syncProjectToTempDir(projectId: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dcode-run-'));
  const dbFiles = await prisma.file.findMany({ where: { projectId } });
  
  for (const f of dbFiles) {
    const fullPath = path.join(root, f.path);
    if (f.type === 'folder') {
      await fs.mkdir(fullPath, { recursive: true });
    } else {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, f.content || '');
    }
  }
  return root;
}

// --- Run Execution Endpoint ---

app.post('/api/run', async (request, reply) => {
  const { language, filename, project: projectId } = request.body as { language: string; filename: string; project?: string };
  if (!projectId) return reply.status(400).send({ error: 'Project ID required' });
  
  let root = '';
  try {
    // Write code to a temporary directory
    root = await syncProjectToTempDir(projectId);

    let command = '';
    const safeFilename = `"${filename}"`;
    
    // We expect execution from the root of the project
    switch (language) {
      case 'javascript':
        command = `node ${safeFilename}`;
        break;
      case 'typescript':
        command = `npx tsx ${safeFilename}`;
        break;
      case 'python':
        command = `python ${safeFilename}`;
        break;
      case 'java':
        const nameWithoutExt = filename.replace(/\.java$/, '');
        command = `javac ${safeFilename} && java ${nameWithoutExt}`;
        break;
      case 'cpp':
        command = `g++ ${safeFilename} -o a.exe && a.exe`;
        break;
      case 'c':
        command = `gcc ${safeFilename} -o a.exe && a.exe`;
        break;
      case 'go':
        command = `go run ${safeFilename}`;
        break;
      case 'rust':
        command = `rustc ${safeFilename} -o a.exe && a.exe`;
        break;
      default:
        command = `node ${safeFilename}`;
    }

    try {
      const { stdout, stderr } = await execAsync(command, { cwd: root });
      return reply.send({ output: stdout + (stderr ? '\n[Error Output]:\n' + stderr : '') });
    } catch (err: any) {
      return reply.send({ output: err.stdout + '\n' + err.stderr });
    }

  } catch (error: any) {
    app.log.error(error);
    return reply.status(500).send({ error: 'Execution failed: ' + error.message });
  } finally {
    if (root) {
      // Clean up the temporary directory after execution is complete
      await fs.rm(root, { recursive: true, force: true }).catch(() => {});
    }
  }
});

// --- AI Debugging Endpoint ---
app.post('/api/ai/fix', async (request, reply) => {
  const { code, errorOutput, language, messages } = request.body as { code?: string; errorOutput?: string; language?: string; messages?: {role: 'user'|'assistant', content: string}[] };

  if (!process.env.GROQ_API_KEY) {
    return reply.status(500).send({ error: 'GROQ_API_KEY is not set in the environment variables.' });
  }

  try {
    let apiMessages: {role: 'user'|'assistant', content: string}[] = [];
    
    if (!messages || messages.length === 0) {
      if (!code || !errorOutput) return reply.status(400).send({ error: 'Code and error output required for initial request' });
      
      const prompt = `You are an expert AI programming assistant.
The user has encountered an error while running their ${language} code.

Here is the original code:
\`\`\`${language}
${code}
\`\`\`

Here is the error output:
\`\`\`
${errorOutput}
\`\`\`

1. Provide a brief 1-2 sentence explanation of why the error occurred.
2. Provide the complete corrected code wrapped in a single markdown code block (\`\`\`${language} ... \`\`\`).
Do NOT provide any other formatting or code blocks. Make sure the code block contains the ENTIRE corrected file, not just snippets.`;

      apiMessages = [{ role: 'user', content: prompt }];
    } else {
      apiMessages = messages;
    }

    const chatCompletion = await groq.chat.completions.create({
      messages: apiMessages,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
    });

    const responseText = chatCompletion.choices[0]?.message?.content || '';
    
    // Parse the response to extract any code block
    const codeBlockRegex = /\`\`\`[a-zA-Z]*\n([\s\S]*?)\`\`\`/;
    const match = responseText.match(codeBlockRegex);
    
    let fixedCode = '';
    if (match && match[1]) {
      fixedCode = match[1].trim();
    }

    return reply.send({ message: { role: 'assistant', content: responseText }, fixedCode });
  } catch (error: any) {
    app.log.error(error);
    return reply.status(500).send({ error: 'AI processing failed: ' + error.message });
  }
});

// --- Start the Server ---
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`DCode API running on http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
};

start();
