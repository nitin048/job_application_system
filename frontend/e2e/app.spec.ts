import { test, expect } from "@playwright/test";

test.describe("Autonomous AI Job Application System E2E Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the root
    await page.goto("/");

    // Check if redirected to the Authentication Gate (LoginPage)
    const emailInput = page.locator('input[placeholder="you@example.com"]');
    if (await emailInput.isVisible()) {
      // Navigate to signup page
      await page.locator('button:has-text("Create an Account")').click();

      // Fill in details
      await page.locator('input[placeholder="John Doe"]').fill("E2E Test User");
      await page.locator('input[placeholder="you@example.com"]').fill("e2e@example.com");
      await page.locator('input[placeholder="Min. 8 characters"]').fill("password123");
      await page.locator('input[placeholder="Re-enter password"]').fill("password123");
      await page.locator('input[placeholder="Your answer (case-insensitive)"]').fill("Fluffy");

      // Check terms and click Create Account
      await page.locator('#auth-terms').check();
      await page.getByRole("button", { name: "Create Account" }).click();

      // Ensure we transition successfully to the main dashboard view
      await expect(page.locator("h1")).toContainText("Dashboard", { timeout: 10000 });
    }
  });

  test("1. Land on Dashboard and verify layout, then navigate to Control Center", async ({ page }) => {
    // Check that we see the page title / header for Dashboard
    await expect(page.locator("h1")).toContainText("Dashboard");
    await expect(page.locator("text=Autonomous AI Job Assistant")).toBeVisible();

    // Navigate to Control Center tab in the sidebar
    await page.getByRole("button", { name: "Control Center", exact: true }).click();

    // Verify title changes to Control Center
    await expect(page.locator("h1")).toContainText("Control Center");

    // Check that the terminal console is visible
    await expect(page.locator("text=Output Terminal")).toBeVisible();
    await expect(page.locator('button[title="Clear logs"]')).toBeVisible();
  });

  test("2. Navigate to Discovered Jobs tab and check basic interaction", async ({ page }) => {
    // Click on Discovered Jobs tab in the sidebar
    await page.getByRole("button", { name: "Discovered Jobs" }).click();

    // Verify title changes
    await expect(page.locator("h1")).toContainText("Discovered Jobs");

    // Check search / filter input exists
    const searchInput = page.locator('input[placeholder="Search title, company, skill..."]');
    await expect(searchInput).toBeVisible();

    // Interact with search filter input
    await searchInput.fill("Software Engineer");
    await expect(searchInput).toHaveValue("Software Engineer");
  });

  test("3. Navigate to Resume Hub tab and verify layout and sub-components", async ({ page }) => {
    // Click on Resume Hub tab in sidebar
    await page.getByRole("button", { name: "Resume Hub" }).click();

    // Verify page header
    await expect(page.locator("h1")).toContainText("Resume Hub");

    // Check the primary elements
    await expect(page.locator("text=1. Upload Original Resume")).toBeVisible();
    await expect(page.locator("text=2. Job Details & ATS Audit")).toBeVisible();
    await expect(page.locator("text=ATS Compatibility Audit")).toBeVisible();
    await expect(page.locator("text=Local Database Copies")).toBeVisible();
    await expect(page.locator("text=Email Client")).toBeVisible();
  });

  test("4. Navigate through config tabs and verify Save banner on modification", async ({ page }) => {
    // Click on "Search Scope" configuration tab
    await page.getByRole("button", { name: "Search Scope" }).click();
    await expect(page.locator("h1")).toContainText("Search Scope");

    // Find the positions input field, fill in some new text to trigger modification
    const positionsInput = page.locator("#positions-input");
    await expect(positionsInput).toBeVisible();
    const originalValue = await positionsInput.inputValue();
    await positionsInput.fill(originalValue ? `${originalValue}, QA Engineer` : "QA Engineer");

    // Verify the sticky Save/Discard configurations banner slides up and becomes visible
    await expect(page.locator("text=You have unsaved changes in your configurations")).toBeVisible();
    await expect(page.getByRole("button", { name: "Discard", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Settings", exact: true })).toBeVisible();

    // Discard changes
    await page.getByRole("button", { name: "Discard", exact: true }).click();
    await expect(page.locator("text=You have unsaved changes in your configurations")).not.toBeVisible();
  });

  test("5. Navigate to System Diagnostics page and check basic elements", async ({ page }) => {
    // Click on System Diagnostics tab in sidebar
    await page.getByRole("button", { name: "System Diagnostics", exact: true }).click();

    // Verify title
    await expect(page.locator("h1")).toContainText("System Diagnostics");

    // Check header section
    await expect(page.locator("text=Runtime Logs & Exception Tracking")).toBeVisible();
  });

  test("6. Resume Hub upload, crawl and tailor flow", async ({ page }) => {
    test.setTimeout(90000);
    // Navigate to Resume Hub tab
    await page.getByRole("button", { name: "Resume Hub" }).click();

    // Upload a test resume
    await page.setInputFiles('input[type="file"]', "../backend/assets/resume_hub/original/Resume (3).pdf");

    // Expect successful upload toast
    await expect(page.locator("text=Resume successfully uploaded to hub workspace!")).toBeVisible({ timeout: 15000 });

    // Fill in a job description URL
    const urlInput = page.locator('input[placeholder*="Paste job portal listing URL"]');
    await urlInput.fill("https://autodesk.wd1.myworkdayjobs.com/Ext/job/Pune-IND/Senior-Software-Engineer_25WD93636-1?src=JB-10065&source=LinkedIn");

    // Click Tailor & Match (New)
    await page.getByRole("button", { name: "Tailor & Match (New)" }).click();

    // Wait for the crawl and tailor to complete and update the scorecard
    await expect(page.locator("text=Resume tailored successfully!")).toBeVisible({ timeout: 60000 });

    // Verify that the tailored scorecard circular gauge is visible
    await expect(page.locator("text=Tailored").first()).toBeVisible();
  });

  test("7. Resume Hub general ATS audit without job URL", async ({ page }) => {
    test.setTimeout(45000);
    // Navigate to Resume Hub tab
    await page.getByRole("button", { name: "Resume Hub" }).click();

    // Upload a test resume
    await page.setInputFiles('input[type="file"]', "../backend/assets/resume_hub/original/Resume (3).pdf");

    // Expect successful upload toast
    await expect(page.locator("text=Resume successfully uploaded to hub workspace!")).toBeVisible({ timeout: 15000 });

    // Verify there is NO URL entered (empty Job description URL input)
    const urlInput = page.locator('input[placeholder*="Paste job portal listing URL"]');
    await expect(urlInput).toHaveValue("");

    // Click Analyze ATS
    await page.getByRole("button", { name: "Analyze ATS" }).click();

    // Wait for general ATS audit to complete
    await expect(page.locator("text=ATS audit completed!")).toBeVisible({ timeout: 30000 });

    // Verify that the scorecard gauge is visible with "Score" text
    await expect(page.locator("text=Score").first()).toBeVisible();
  });

  test("8. Navigate to About tab and verify layout, author details, disclaimers and footer", async ({ page }) => {
    // Click on About tab in sidebar
    await page.getByRole("button", { name: "About" }).click();

    // Verify title and description
    await expect(page.locator("header h1")).toContainText("About");
    await expect(page.locator("text=Learn more about Aegis Flow system design")).toBeVisible();

    // Verify main components of the page
    await expect(page.locator("text=Aegis Flow").nth(1)).toBeVisible();
    await expect(page.locator("text=Nitin Pradhan").first()).toBeVisible();
    await expect(page.locator("text=Developed with").first()).toBeVisible();
    await expect(page.locator("text=by").first()).toBeVisible();
    await expect(page.locator("text=Copyright © 2026 Aegis Flow")).toBeVisible();
    await expect(page.locator("text=Legal Disclaimer & Terms")).toBeVisible();
  });

  test("9. Test sessionStorage configuration persistence and isolation on refresh", async ({ page, context }) => {
    // Navigate to Search Scope configuration tab
    await page.getByRole("button", { name: "Search Scope" }).click();
    
    // Fill in a unique position target
    const positionsInput = page.locator("#positions-input");
    await expect(positionsInput).toBeVisible();
    await positionsInput.fill("E2E Test Session Engineer");
    
    // Save changes
    await page.getByRole("button", { name: "Save Settings", exact: true }).click();
    await expect(page.locator("text=You have unsaved changes in your configurations")).not.toBeVisible();
    
    // Refresh page
    await page.reload();
    
    // Check that the saved position target persists after refresh
    await page.getByRole("button", { name: "Search Scope" }).click();
    await expect(positionsInput).toHaveValue("E2E Test Session Engineer");
    
    // Open a completely new tab/context to verify session isolation
    const newPage = await context.newPage();
    await newPage.goto("/");
    
    // Navigate to Search Scope on the new page
    await newPage.getByRole("button", { name: "Search Scope" }).click();
    const newPositionsInput = newPage.locator("#positions-input");
    await expect(newPositionsInput).toBeVisible();
    
    // The value should be empty / not have "E2E Test Session Engineer" (isolation check)
    await expect(newPositionsInput).not.toHaveValue("E2E Test Session Engineer");
    await newPage.close();
  });

  test("10. Test Search Filters suggestions, spaces, and commas behavior", async ({ page }) => {
    // Navigate to Search Scope configuration tab
    await page.getByRole("button", { name: "Search Scope" }).click();

    const positionsInput = page.locator("#positions-input");
    await expect(positionsInput).toBeVisible();

    // Clear the input
    await positionsInput.fill("");
    await expect(positionsInput).toHaveValue("");

    // Type a value and verify it stays
    await positionsInput.pressSequentially("React Developer");
    await expect(positionsInput).toHaveValue("React Developer");

    // Type a comma and space, verify they stay
    await positionsInput.pressSequentially(", ");
    await expect(positionsInput).toHaveValue("React Developer, ");

    // Type 'Dev' to trigger suggestion
    await positionsInput.pressSequentially("Dev");
    await expect(positionsInput).toHaveValue("React Developer, Dev");

    // Suggestion box should be visible
    const suggestionBox = page.locator("text=Popular Job Titles:");
    await expect(suggestionBox).toBeVisible();

    // Click on suggestion '+ DevOps Engineer'
    const devOpsBtn = page.getByRole("button", { name: "+ DevOps Engineer", exact: true });
    await expect(devOpsBtn).toBeVisible();
    await devOpsBtn.click();

    // The value should now have DevOps Engineer appended
    await expect(positionsInput).toHaveValue("React Developer, DevOps Engineer");

    // Discard the changes
    await page.getByRole("button", { name: "Discard", exact: true }).click();
  });
});

