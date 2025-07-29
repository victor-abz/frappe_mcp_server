#!/usr/bin/env node

/**
 * MCP Server Publisher Agent
 * 
 * A specialized agent for NPM package publishing of MCP servers with proper workflow automation.
 * Implements NPM best practices including version collision detection, proper versioning workflow,
 * build validation, git integration, and comprehensive error handling.
 * 
 * Features:
 * - Pre-flight version collision detection
 * - Proper NPM version workflow using `npm version`
 * - Complete publication workflow with safety checks
 * - Build validation and testing
 * - Git integration with commits and tags
 * - Error handling and rollback mechanisms
 * - MCP server-specific validation
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PackageInfo {
  name: string;
  version: string;
  description?: string;
  main?: string;
  bin?: Record<string, string>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface PublishOptions {
  versionType: 'patch' | 'minor' | 'major';
  dryRun?: boolean;
  skipTests?: boolean;
  skipBuild?: boolean;
  force?: boolean;
  tag?: string;
  customVersion?: string;
}

interface PublishResult {
  success: boolean;
  version?: string;
  previousVersion?: string;
  messages: string[];
  errors: string[];
  rollbackInstructions: string[];
}

export class MCPServerPublisher {
  private projectRoot: string;
  private packagePath: string;
  private pkg: PackageInfo | null = null;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.packagePath = path.join(this.projectRoot, 'package.json');
  }

  /**
   * Initialize the publisher by loading package.json
   */
  async initialize(): Promise<void> {
    try {
      const packageContent = await fs.readFile(this.packagePath, 'utf-8');
      this.pkg = JSON.parse(packageContent);
      
      if (!this.pkg?.name) {
        throw new Error('package.json must contain a valid name field');
      }
      
      console.log(`📦 Initialized MCP Server Publisher for: ${this.pkg.name}@${this.pkg.version}`);
    } catch (error) {
      throw new Error(`Failed to initialize publisher: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if a specific version already exists on NPM
   */
  async checkVersionExists(version: string, packageName?: string): Promise<boolean> {
    const name = packageName || this.pkg?.name;
    if (!name) throw new Error('Package name not available');

    try {
      const { stdout } = await execAsync(`npm view ${name}@${version} version 2>/dev/null || echo "NOT_FOUND"`);
      const result = stdout.trim();
      
      if (result === 'NOT_FOUND' || result === '') {
        return false;
      }
      
      return result === version;
    } catch (error) {
      // If npm view fails, assume version doesn't exist
      return false;
    }
  }

  /**
   * Get the latest published version from NPM
   */
  async getLatestVersion(packageName?: string): Promise<string | null> {
    const name = packageName || this.pkg?.name;
    if (!name) throw new Error('Package name not available');

    try {
      const { stdout } = await execAsync(`npm view ${name} version 2>/dev/null || echo "NOT_FOUND"`);
      const result = stdout.trim();
      
      if (result === 'NOT_FOUND' || result === '') {
        return null;
      }
      
      return result;
    } catch (error) {
      return null;
    }
  }

  /**
   * Suggest the next available version based on version type
   */
  async suggestNextVersion(versionType: 'patch' | 'minor' | 'major'): Promise<string> {
    if (!this.pkg) throw new Error('Package not initialized');

    const currentVersion = this.pkg.version;
    const [major, minor, patch] = currentVersion.split('.').map(Number);

    let suggestedVersion: string;
    
    switch (versionType) {
      case 'major':
        suggestedVersion = `${major + 1}.0.0`;
        break;
      case 'minor':
        suggestedVersion = `${major}.${minor + 1}.0`;
        break;
      case 'patch':
      default:
        suggestedVersion = `${major}.${minor}.${patch + 1}`;
        break;
    }

    // Check if suggested version exists and increment if needed
    let finalVersion = suggestedVersion;
    let counter = 0;
    
    while (await this.checkVersionExists(finalVersion)) {
      counter++;
      if (versionType === 'patch') {
        finalVersion = `${major}.${minor}.${patch + 1 + counter}`;
      } else if (versionType === 'minor') {
        finalVersion = `${major}.${minor + 1}.${counter}`;
      } else {
        finalVersion = `${major + 1}.0.${counter}`;
      }
      
      // Safety break to avoid infinite loops
      if (counter > 100) {
        throw new Error('Could not find available version after 100 attempts');
      }
    }

    return finalVersion;
  }

  /**
   * Run pre-flight safety checks
   */
  async runPreflightChecks(): Promise<{ success: boolean; messages: string[]; errors: string[] }> {
    const messages: string[] = [];
    const errors: string[] = [];

    try {
      // Check git status
      const { stdout: gitStatus } = await execAsync('git status --porcelain');
      if (gitStatus.trim()) {
        errors.push('Working directory is not clean. Commit or stash changes before publishing.');
      } else {
        messages.push('✅ Working directory is clean');
      }

      // Check if we're on the right branch (typically main/master)
      const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD');
      const branch = currentBranch.trim();
      if (!['main', 'master'].includes(branch)) {
        messages.push(`⚠️  Publishing from branch '${branch}' (not main/master)`);
      } else {
        messages.push(`✅ On branch '${branch}'`);
      }

      // Check if we can pull from remote
      try {
        await execAsync('git fetch origin', { timeout: 10000 });
        const { stdout: behindCount } = await execAsync(`git rev-list --count HEAD..origin/${branch}`);
        if (parseInt(behindCount.trim()) > 0) {
          errors.push(`Local branch is ${behindCount.trim()} commits behind remote. Run 'git pull' first.`);
        } else {
          messages.push('✅ Local branch is up to date with remote');
        }
      } catch (error) {
        messages.push('⚠️  Could not check remote status (network issue?)');
      }

      // Check if package.json exists and is valid
      if (!this.pkg) {
        errors.push('package.json not loaded or invalid');
      } else {
        messages.push('✅ package.json is valid');
      }

      // Check if build directory exists or can be created
      const buildDir = path.join(this.projectRoot, 'build');
      try {
        await fs.access(buildDir);
        messages.push('✅ Build directory exists');
      } catch (error) {
        messages.push('ℹ️  Build directory will be created during build');
      }

    } catch (error) {
      errors.push(`Preflight check failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      success: errors.length === 0,
      messages,
      errors
    };
  }

  /**
   * Run build process
   */
  async runBuild(): Promise<{ success: boolean; messages: string[]; errors: string[] }> {
    const messages: string[] = [];
    const errors: string[] = [];

    try {
      messages.push('🔨 Running TypeScript compilation...');
      
      // Clean build directory
      const buildDir = path.join(this.projectRoot, 'build');
      try {
        await fs.rm(buildDir, { recursive: true, force: true });
        await fs.mkdir(buildDir, { recursive: true });
      } catch (error) {
        // Directory might not exist, continue
      }

      // Run TypeScript build
      const { stdout: buildOutput, stderr: buildError } = await execAsync('npm run build', { 
        cwd: this.projectRoot,
        timeout: 60000 
      });
      
      if (buildError && buildError.includes('error')) {
        errors.push(`Build failed: ${buildError}`);
      } else {
        messages.push('✅ TypeScript compilation successful');
        if (buildOutput.trim()) {
          messages.push(`Build output: ${buildOutput.trim()}`);
        }
      }

      // Verify build artifacts
      const mainFile = this.pkg?.main || 'build/index.js';
      const mainPath = path.join(this.projectRoot, mainFile);
      
      try {
        await fs.access(mainPath);
        messages.push(`✅ Main file exists: ${mainFile}`);
      } catch (error) {
        errors.push(`Main file not found: ${mainFile}`);
      }

      // Check bin files if they exist
      if (this.pkg?.bin) {
        for (const [binName, binPath] of Object.entries(this.pkg.bin)) {
          const fullBinPath = path.join(this.projectRoot, binPath);
          try {
            await fs.access(fullBinPath);
            messages.push(`✅ Binary exists: ${binName} -> ${binPath}`);
          } catch (error) {
            errors.push(`Binary not found: ${binName} -> ${binPath}`);
          }
        }
      }

    } catch (error) {
      errors.push(`Build process failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      success: errors.length === 0,
      messages,
      errors
    };
  }

  /**
   * Run tests if available
   */
  async runTests(): Promise<{ success: boolean; messages: string[]; errors: string[] }> {
    const messages: string[] = [];
    const errors: string[] = [];

    try {
      if (!this.pkg?.scripts?.test && !this.pkg?.scripts?.['test:ci']) {
        messages.push('ℹ️  No test script found, skipping tests');
        return { success: true, messages, errors };
      }

      const testScript = this.pkg.scripts.test || this.pkg.scripts['test:ci'];
      messages.push(`🧪 Running tests: ${testScript}`);

      const { stdout: testOutput, stderr: testError } = await execAsync('npm test', {
        cwd: this.projectRoot,
        timeout: 120000 // 2 minutes for tests
      });

      if (testError && testError.includes('failed')) {
        errors.push(`Tests failed: ${testError}`);
      } else {
        messages.push('✅ All tests passed');
        if (testOutput.trim()) {
          messages.push(`Test output: ${testOutput.trim()}`);
        }
      }

    } catch (error) {
      errors.push(`Test execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      success: errors.length === 0,
      messages,
      errors
    };
  }

  /**
   * Update version using npm version command
   */
  async updateVersion(versionType: 'patch' | 'minor' | 'major', customVersion?: string): Promise<{ success: boolean; version?: string; messages: string[]; errors: string[] }> {
    const messages: string[] = [];
    const errors: string[] = [];

    try {
      const previousVersion = this.pkg?.version;
      
      let versionCommand: string;
      if (customVersion) {
        // Validate custom version format
        if (!/^\d+\.\d+\.\d+(-.*)?$/.test(customVersion)) {
          errors.push(`Invalid version format: ${customVersion}. Use semantic versioning (e.g., 1.2.3)`);
          return { success: false, messages, errors };
        }
        
        // Check if custom version already exists
        if (await this.checkVersionExists(customVersion)) {
          errors.push(`Version ${customVersion} already exists on NPM`);
          return { success: false, messages, errors };
        }
        
        versionCommand = `npm version ${customVersion}`;
      } else {
        // Get next available version
        const nextVersion = await this.suggestNextVersion(versionType);
        versionCommand = `npm version ${nextVersion}`;
      }

      messages.push(`📈 Updating version: ${versionCommand}`);

      const { stdout: versionOutput } = await execAsync(versionCommand, {
        cwd: this.projectRoot,
        timeout: 30000
      });

      const newVersion = versionOutput.trim().replace(/^v/, '');
      
      // Reload package.json to get updated version
      await this.initialize();
      
      messages.push(`✅ Version updated: ${previousVersion} → ${newVersion}`);
      
      return {
        success: true,
        version: newVersion,
        messages,
        errors
      };

    } catch (error) {
      errors.push(`Version update failed: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, messages, errors };
    }
  }

  /**
   * Publish to NPM
   */
  async publishPackage(tag: string = 'latest'): Promise<{ success: boolean; messages: string[]; errors: string[] }> {
    const messages: string[] = [];
    const errors: string[] = [];

    try {
      const publishCommand = `npm publish --access public --tag ${tag}`;
      messages.push(`📤 Publishing to NPM: ${publishCommand}`);

      const { stdout: publishOutput, stderr: publishError } = await execAsync(publishCommand, {
        cwd: this.projectRoot,
        timeout: 120000 // 2 minutes for publish
      });

      if (publishError && (publishError.includes('error') || publishError.includes('ERR!'))) {
        errors.push(`Publish failed: ${publishError}`);
      } else {
        messages.push('✅ Package published successfully');
        if (publishOutput.trim()) {
          messages.push(`Publish output: ${publishOutput.trim()}`);
        }
      }

    } catch (error) {
      errors.push(`Publish process failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      success: errors.length === 0,
      messages,
      errors
    };
  }

  /**
   * Push git changes and tags
   */
  async pushGitChanges(): Promise<{ success: boolean; messages: string[]; errors: string[] }> {
    const messages: string[] = [];
    const errors: string[] = [];

    try {
      // Push commits
      messages.push('📤 Pushing git commits...');
      const { stdout: pushOutput } = await execAsync('git push', {
        cwd: this.projectRoot,
        timeout: 60000
      });
      
      messages.push('✅ Git commits pushed');
      
      // Push tags
      messages.push('🏷️  Pushing git tags...');
      const { stdout: pushTagsOutput } = await execAsync('git push --tags', {
        cwd: this.projectRoot,
        timeout: 60000
      });
      
      messages.push('✅ Git tags pushed');

    } catch (error) {
      errors.push(`Git push failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      success: errors.length === 0,
      messages,
      errors
    };
  }

  /**
   * Main publish workflow
   */
  async publish(options: PublishOptions): Promise<PublishResult> {
    const result: PublishResult = {
      success: false,
      messages: [],
      errors: [],
      rollbackInstructions: []
    };

    try {
      if (!this.pkg) {
        await this.initialize();
      }

      const previousVersion = this.pkg!.version;
      result.previousVersion = previousVersion;

      console.log(`\n🚀 Starting MCP Server Publication Process`);
      console.log(`📦 Package: ${this.pkg!.name}@${previousVersion}`);
      console.log(`📈 Version Type: ${options.versionType}`);
      
      if (options.dryRun) {
        console.log(`🧪 DRY RUN MODE - No actual changes will be made\n`);
      } else {
        console.log(`⚠️  LIVE MODE - Changes will be made to NPM and Git\n`);
      }

      // Step 1: Pre-flight checks
      console.log('Step 1: Running pre-flight checks...');
      const preflightResult = await this.runPreflightChecks();
      result.messages.push(...preflightResult.messages);
      result.errors.push(...preflightResult.errors);

      if (!preflightResult.success && !options.force) {
        console.log('❌ Pre-flight checks failed');
        return result;
      }

      if (options.dryRun) {
        result.messages.push('🧪 DRY RUN: Would proceed with pre-flight checks');
      }

      // Step 2: Build
      if (!options.skipBuild) {
        console.log('\nStep 2: Building package...');
        const buildResult = await this.runBuild();
        result.messages.push(...buildResult.messages);
        result.errors.push(...buildResult.errors);

        if (!buildResult.success) {
          console.log('❌ Build failed');
          return result;
        }

        if (options.dryRun) {
          result.messages.push('🧪 DRY RUN: Would complete build process');
        }
      }

      // Step 3: Tests
      if (!options.skipTests) {
        console.log('\nStep 3: Running tests...');
        const testResult = await this.runTests();
        result.messages.push(...testResult.messages);
        result.errors.push(...testResult.errors);

        if (!testResult.success) {
          console.log('❌ Tests failed');
          return result;
        }

        if (options.dryRun) {
          result.messages.push('🧪 DRY RUN: Would complete test execution');
        }
      }

      if (options.dryRun) {
        // For dry run, simulate version calculation
        const nextVersion = options.customVersion || await this.suggestNextVersion(options.versionType);
        result.version = nextVersion;
        result.messages.push(`🧪 DRY RUN: Would update version to ${nextVersion}`);
        result.messages.push('🧪 DRY RUN: Would publish to NPM');
        result.messages.push('🧪 DRY RUN: Would push git changes and tags');
        result.success = true;
        return result;
      }

      // Step 4: Version update
      console.log('\nStep 4: Updating version...');
      const versionResult = await this.updateVersion(options.versionType, options.customVersion);
      result.messages.push(...versionResult.messages);
      result.errors.push(...versionResult.errors);

      if (!versionResult.success) {
        console.log('❌ Version update failed');
        return result;
      }

      result.version = versionResult.version;
      result.rollbackInstructions.push(`git reset --hard HEAD~1`);
      result.rollbackInstructions.push(`git tag -d v${versionResult.version}`);

      // Step 5: Publish
      console.log('\nStep 5: Publishing to NPM...');
      const publishResult = await this.publishPackage(options.tag);
      result.messages.push(...publishResult.messages);
      result.errors.push(...publishResult.errors);

      if (!publishResult.success) {
        console.log('❌ NPM publish failed');
        result.rollbackInstructions.push(`npm unpublish ${this.pkg!.name}@${versionResult.version} --force`);
        return result;
      }

      // Step 6: Push git changes
      console.log('\nStep 6: Pushing git changes...');
      const gitResult = await this.pushGitChanges();
      result.messages.push(...gitResult.messages);
      result.errors.push(...gitResult.errors);

      if (!gitResult.success) {
        console.log('⚠️  Git push failed, but package was published');
        result.rollbackInstructions.push(`Manual git push required`);
        // Don't fail the entire process for git push failures
      }

      result.success = true;
      console.log(`\n✅ Publication Complete!`);
      console.log(`📦 ${this.pkg!.name}@${result.version} published successfully`);

    } catch (error) {
      result.errors.push(`Publication failed: ${error instanceof Error ? error.message : String(error)}`);
      console.log(`❌ Publication failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Command-line interface methods
   */
  
  async handleCheckVersion(version: string): Promise<void> {
    await this.initialize();
    const exists = await this.checkVersionExists(version);
    const latest = await this.getLatestVersion();
    
    console.log(`\n📦 Package: ${this.pkg!.name}`);
    console.log(`🔍 Checking version: ${version}`);
    console.log(`📋 Current local version: ${this.pkg!.version}`);
    console.log(`📋 Latest published version: ${latest || 'Not published'}`);
    console.log(`${exists ? '❌' : '✅'} Version ${version} ${exists ? 'already exists' : 'is available'}`);
  }

  async handleSuggestVersion(): Promise<void> {
    await this.initialize();
    
    const patchVersion = await this.suggestNextVersion('patch');
    const minorVersion = await this.suggestNextVersion('minor');
    const majorVersion = await this.suggestNextVersion('major');
    
    console.log(`\n📦 Package: ${this.pkg!.name}`);
    console.log(`📋 Current version: ${this.pkg!.version}`);
    console.log(`\n💡 Suggested next versions:`);
    console.log(`   Patch: ${patchVersion} (bug fixes)`);
    console.log(`   Minor: ${minorVersion} (new features)`);
    console.log(`   Major: ${majorVersion} (breaking changes)`);
  }

  async handlePublish(versionType: 'patch' | 'minor' | 'major', options: Partial<PublishOptions> = {}): Promise<void> {
    const publishOptions: PublishOptions = {
      versionType,
      ...options
    };

    const result = await this.publish(publishOptions);
    
    if (result.success) {
      console.log(`\n🎉 Success! ${this.pkg!.name}@${result.version} published`);
    } else {
      console.log(`\n❌ Publication failed`);
      
      if (result.rollbackInstructions && result.rollbackInstructions.length > 0) {
        console.log(`\n🔄 Rollback instructions:`);
        result.rollbackInstructions.forEach((instruction, index) => {
          console.log(`   ${index + 1}. ${instruction}`);
        });
      }
    }

    // Display summary
    console.log(`\n📊 Summary:`);
    result.messages.forEach(msg => console.log(`   ${msg}`));
    
    if (result.errors.length > 0) {
      console.log(`\n🚨 Errors:`);
      result.errors.forEach(error => console.log(`   ${error}`));
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const publisher = new MCPServerPublisher();

  try {
    switch (command) {
      case '/publish-patch':
        await publisher.handlePublish('patch', { 
          dryRun: args.includes('--dry-run'),
          skipTests: args.includes('--skip-tests'),
          skipBuild: args.includes('--skip-build'),
          force: args.includes('--force')
        });
        break;
        
      case '/publish-minor':
        await publisher.handlePublish('minor', { 
          dryRun: args.includes('--dry-run'),
          skipTests: args.includes('--skip-tests'),
          skipBuild: args.includes('--skip-build'),
          force: args.includes('--force')
        });
        break;
        
      case '/publish-major':
        await publisher.handlePublish('major', { 
          dryRun: args.includes('--dry-run'),
          skipTests: args.includes('--skip-tests'),
          skipBuild: args.includes('--skip-build'),
          force: args.includes('--force')
        });
        break;
        
      case '/check-version':
        const version = args[1];
        if (!version) {
          console.log('Usage: /check-version <version>');
          process.exit(1);
        }
        await publisher.handleCheckVersion(version);
        break;
        
      case '/suggest-version':
        await publisher.handleSuggestVersion();
        break;
        
      case '/dry-run':
        const dryRunType = args[1] as 'patch' | 'minor' | 'major' || 'patch';
        await publisher.handlePublish(dryRunType, { dryRun: true });
        break;
        
      default:
        console.log(`
🚀 MCP Server Publisher Agent

Usage:
  /publish-patch [options]    - Publish patch version update
  /publish-minor [options]    - Publish minor version update  
  /publish-major [options]    - Publish major version update
  /check-version <version>    - Check if version exists
  /suggest-version           - Suggest next available version
  /dry-run [patch|minor|major] - Simulate publication

Options:
  --dry-run      - Preview changes without publishing
  --skip-tests   - Skip test execution
  --skip-build   - Skip build process
  --force        - Ignore preflight check failures

Examples:
  /publish-patch
  /publish-minor --dry-run
  /check-version 1.2.3
  /suggest-version
        `);
        break;
    }
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default MCPServerPublisher;