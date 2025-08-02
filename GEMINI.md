## Working instructions

Consult SPEC.md before beginning any plan. If the new thing needing to be planned is not in the spec, once you've thought of it, add it to the spec. Integrate it in the right section. Do not reformat other parts of the spec. Treat it as additive. If it needs to be reorganized I will do th at.


You will need to create plans for specs, and then checklists of tasks. The tasks have a specific way to think about each item on the checklist:

   1. Atomic: It represents the smallest possible change that can be made  
      without leaving the application in a broken state.
   2. Incremental: The tasks build upon one another in a logical sequence. 
      You must complete step 1 before moving to step 2, as step 2 depends  
      on the work done in step 1.
   3. Always Functional: After completing any single task on the checklist,
      the options page should still be fully functional. This allows for   
      testing and verification at every step of the process, ensuring a    
      stable and predictable development flow.

  Essentially, instead of a broad list of features, you want a precise,
  step-by-step guide for refactoring the code that ensures the
  application works correctly after every single change is implemented.


When executing and writing code for tasks, make sure to check each item off the list as its done and prior to starting the next task.
