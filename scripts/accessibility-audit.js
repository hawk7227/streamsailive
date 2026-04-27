import puppeteer from 'puppeteer';
import { AxePuppeteer } from '@axe-core/puppeteer';
import fs from 'fs';

(async () => {
  let browser;
  try {
    console.log('Starting accessibility audit...');
    
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    const page = await browser.newPage();
    
    const testUrl = process.env.TEST_URL || 'http://localhost:3000/streams';
    console.log(`\nRunning accessibility audit on: ${testUrl}\n`);
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });
    
    // Navigate to page
    console.log('Loading page...');
    await page.goto(testUrl, { waitUntil: 'networkidle2' });
    console.log('✓ Page loaded\n');
    
    // Run Axe accessibility audit
    console.log('Running Axe accessibility scan...');
    const results = await new AxePuppeteer(page).analyze();
    
    console.log('\n================================================');
    console.log('ACCESSIBILITY AUDIT RESULTS');
    console.log('================================================\n');
    
    console.log(`Violations: ${results.violations.length}`);
    console.log(`Passes: ${results.passes.length}`);
    console.log(`Incomplete: ${results.incomplete.length}`);
    console.log('');
    
    if (results.violations.length > 0) {
      console.log('VIOLATIONS FOUND:');
      console.log('================');
      results.violations.forEach((violation, index) => {
        console.log(`\n${index + 1}. ${violation.id} (${violation.impact})`);
        console.log(`   ${violation.description}`);
        console.log(`   Affected elements: ${violation.nodes.length}`);
      });
    } else {
      console.log('✅ No accessibility violations found!');
    }
    
    if (results.incomplete.length > 0) {
      console.log('\n\nINCOMPLETE (requires manual review):');
      console.log('====================================');
      results.incomplete.forEach((item, index) => {
        console.log(`\n${index + 1}. ${item.id}`);
        console.log(`   ${item.description}`);
      });
    }
    
    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      url: testUrl,
      summary: {
        violations: results.violations.length,
        passes: results.passes.length,
        incomplete: results.incomplete.length,
      },
      violations: results.violations,
      incomplete: results.incomplete,
    };
    
    const reportPath = 'accessibility-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✓ Detailed report saved to: ${reportPath}`);
    
    console.log('\n================================================');
    
    // Exit with appropriate code
    const exitCode = results.violations.length > 0 ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    console.error('❌ Error running accessibility audit:');
    console.error(error);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
