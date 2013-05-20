/* CSTManager.js */

var asTree = new Tree();
var epsilonFound = false;
var composingControl = false; //Because control statements have slightly different structures, I feel this will be better help check the flow of recursion
var numBlocks = 0;

//-----------------------------------------
// treeDemo.js
//
// By Alan G. Labouseur, based on the 2009
// work by Michael Ardizzone and Tim Smith.
//-----------------------------------------
function Tree() {
// ----------
// Attributes
// ----------
  this.root = null; // Note the NULL root node of this tree.
	this.cur = {}; // Note the EMPTY current node of the tree we're building.
// -- ------- --
// -- Methods --
// -- ------- --
// Add a node: kind in {branch, leaf}.
	this.addNode = function(name, kind) {
// Construct the node object. 
	var node = { name: name,
				children: [],
				parent: {}
};
// Check to see if it needs to be the root node.
if ( (this.root == null) || (!this.root) )
{
// We are the root node.
	this.root = node;
} 
else
{
// We are the children.
// Make our parent the CURrent node...
	node.parent = this.cur;
// ... and add ourselves (via the unfortunately-named
// "push" function) to the children array of the current node. 
	this.cur.children.push(node);
}
// If we are an interior/branch node, then...
if (kind == "branch")
{
// ... update the CURrent node pointer to ourselves.
	this.cur = node;
}
};
// Note that we're done with this branch of the tree...
this.endChildren = function() {
// ... by moving "up" to our parent node (if possible).
	if ((this.cur.parent !== null) && (this.cur.parent.name !== undefined))
	{
		this.cur = this.cur.parent;
	}
	else
	{
// TODO: Some sort of error logging.
// This really should not happen, but it will, of course.
	}
};

//Creates an AST from the CST using recursive pre-order traversal, taking terminals and putting them into a queue
this.composeAST = function()
{
   var root = this.root;
   if(root.children.length !== 0) //A program should contain something
   {
      var tempRoot = root.children[0]; //Assume it has one child, a statement
	  treeWalker(tempRoot);
   }
}

//Recursive function using pre-order traversal
function treeWalker(node)
{
	var nodeName = node.name;
	//If the program is not empty, then node can only be a statement if this the first call of tree walker
	//(Subsequent calls can and will vary)
	if(nodeName == "statement")
	{
		checkStmtFirstSet(node);
		if(epsilonFound || codeLines.length == 1) //Ride the recursion to freedom!
			return;
		var newNode = node.parent.children[1]; //The statement's sibling, a statement list
		composeStmtListAST(newNode);
	}
	//Like so
	else if(nodeName == "expr")
	{
		checkExprFirstSet(node);
		if(codeLines.length == 1)
			return;
			/*
		if(composingControl)
		{
			var newNode = node.parent.children[3];
			treeWalker(newNode);
		}
		else
		*/
		if(!composingControl)
		{
			newNode = node.parent.parent.children[1]; 
			composeStmtListAST(newNode);
		}
	}
	else if(nodeName == "epsilon") //Empty set as result of coming from control statement
	{
		epsilonFound = true;
	}
}

//Statement can be four different types, three of which have distinct CSTs
function checkStmtFirstSet(node)
{
	//Check the first child because all four types have a distinct first child
	var kidType = node.children[0];
	
	if(kidType.name == "print")
	{
		composePrintAST(kidType);
	}
	
	else if(kidType.name == "vardecl")
	{
		composeDeclareAST(kidType);
	}
	
	else if(kidType.name == "id")
	{
		composeAssignAST(kidType);
	}
	
	else if(kidType.name == "{")
	{
		epsilonFound = false;
		composeStmtListAST(kidType);
	}
	else if(kidType.name == "ifstatement")
	{
		composingControl = true;
		composeIfStmtAST(kidType);
		//composingControl == false;
	}
	else if(kidType.name == "whilestatement")
	{
		composingControl = true;
		composeWhileStmtAST(kidType);
		//composingControl = false;
	}
}

//Expr can be three different types
function checkExprFirstSet(node)
{
	//Check the first child because all three types have a distinct first child
	var kidType = node.children[0];
	
	if(kidType.name == "intexpr")
	{
		composeIntExprAST(kidType);
	}
	
	else if(kidType.name == "stringexpr")
	{
		composeStringExprAST(kidType);
	}
	
	else if(kidType.name == "id")
	{
		//This is simple enough to not modularize
		asTree.addNode(kidType.children[0].children[0].name); //The actual ID after is passes through all of the encapsulation
		if(!composingControl)
			asTree.endChildren();
	}
	else if(kidType.name == "booleanexpr")
	{
		composeBooleanExprAST(kidType);
	}
}

function composePrintAST(pNode) //print(Expr)
{
	asTree.addNode("print", "branch");
	var exprSubTree = treeWalker(pNode.parent.children[2]);
}

function composeDeclareAST(dNode) //Type Id
{
	asTree.addNode("declare", "branch");
	var typeNode = dNode.children[0].children[0]; //The first child of a vardecl is the type, 
												  //which has only one child, 'int' or 'string'
	asTree.addNode(typeNode.name, "leaf");
	//asTree.endChildren();
	var charNode = dNode.children[1].children[0];  //The second child of a vardecl is the id,
												   //which has only one child, a char
	var symNode = charNode.children[0].name;
	asTree.addNode(symNode, "leaf");
	asTree.endChildren();
}

function composeAssignAST(aNode) //Id = Expr
{
	asTree.addNode("assign", "branch");
	var symNode = aNode.children[0].children[0].name; //The id value associated with the symbol (after sifting through encapsulation)
	
	asTree.addNode(symNode, "leaf");
	//asTree.endChildren();
	
	var valueSubTree = treeWalker(aNode.parent.children[2]); //The Expr production
}

//An if statement has two children, the check for equality, and the command if the equality is validated
function composeIfStmtAST(iNode)
{
	asTree.addNode("if", "branch");
	composeControlStmtAST(iNode);
}

////An if statement has two children, the check for equality, and the command if the equality is validated
function composeWhileStmtAST(wNode)
{
	asTree.addNode("while", "branch");
	composeControlStmtAST(wNode);
}

//Both if and while statements are constructed in exactly the same method (except for if and while of course), so this method works around duplicating code
function composeControlStmtAST(cNode)
{
	var boolExprType = cNode.children[1];
	composeBooleanExprAST(boolExprType);
	//composingControl = false;
	//asTree.endChildren();
	var openingBrace = cNode.children[2]; //Brace that determines statement list when control statement constraint == true
	composeStmtListAST(openingBrace); 
}

function composeStmtListAST(slNode)
{
	epsilonFound = checkEpsilon(slNode)
	if(!epsilonFound)
	{
		if(slNode.parent.name == "statement" || slNode.parent.name == "ifstatement" || slNode.parent.name == "whilestatement")
		{
			asTree.addNode("block", "branch");
			numBlocks++;
		}
		if(slNode.parent.name == "ifstatement" || slNode.parent.name == "whilestatement")
		{
			var stmtListNode = slNode.parent.children[3]; //The statementlist non-terminal
			//Keep going (call treeWalker b/c all statementlists start with statements?)
			var stmtNode = stmtListNode.children[0]; //A statementlist's first child should only be a statement
			treeWalker(stmtNode);
		}
		else
		{
			epsilonFound = false;
			var stmtListNode = slNode.parent.children[1]; //The statementlist non-terminal
			//Keep going (call treeWalker b/c all statementlists start with statements?)
			var stmtNode = stmtListNode.children[0]; //A statementlist's first child should only be a statement
			treeWalker(stmtNode);
		}
	}
	else
	{
	   if(numBlocks == 1) //Necessary to avoid the inevitable memory leak just below if it falls through
		return; //Ride the recursion to freedom!
	   //csTree.endChildren();
	   asTree.endChildren(); //Back out of the current block (scope)
	  
	   epsilonFound = false;
	   var slParent = slNode.parent;
	   while(slParent.children.length == 2) //Impliest that the two children are a statement and a statement list
	   {
		  slParent = slParent.parent;
	   }
	   if(slParent.parent.name == "program")
	   {
		  epsilonFound = true; //For the purpose of insuring proper program flow
		  return; //It is a thrill to watch Firebug climb through all of the recursion
	   }	
	   var nextNode = slParent.parent.children[1]; //A statement list (we hope)
	   treeWalker(nextNode.children[0]); //A statement (we hope)
	}
}

function composeIntExprAST(ieNode)
{
	if(ieNode.children[1] == null) //No op, therefore the IntExpr is only a digit
	{
	  asTree.addNode(ieNode.children[0].children[0].name, "leaf");
	  if(!composingControl)
		asTree.endChildren();
	}
	else //IntExpr takes form of digit op expr
	{
	  asTree.addNode(ieNode.children[1].children[0].name, "branch"); //The + or -
	  asTree.addNode(ieNode.children[0].children[0].name, "leaf"); //The digit (first of IntExpr)
	  checkExprFirstSet(ieNode.children[2]); //The Expr
	  asTree.endChildren();
	}
	  
}

function composeStringExprAST(seNode)
{
	var value = "";
	//var firstQuote = seNode.children[0].name;
	var theString = seNode.children[1].children[0].name;
	//var secondQuote = seNode.children[2].name;
	value = theString; //Because value is a string, theString is implicitly wrapped in quotes, mimicking the explict inclusion of the quotation marks in the CST
	asTree.addNode(value, "leaf");
	asTree.endChildren();
}

//Equality comparisons can only occur on ints, bools or ids
function composeBooleanExprAST(beNode)
{
	var beType = beNode.children[0];
	if(beType.name == "boolval") //Simple true/false
	{
		asTree.addNode(beType.children[0].name, "leaf");
		//asTree.endChildren();
	}
	else //Complicated expr equality evaluation
	{
		asTree.addNode("isEqual", "branch");
		var expr1 = beNode.children[1]; //Left side of equation
		treeWalker(expr1);
		var expr2 = beNode.children[3]; //Right side of equation
		treeWalker(expr2);
		composingControl = false;
		asTree.endChildren();
	}
	
}

function checkEpsilon(slNode)
{
	if(slNode.children[0] == null)
		return false;
	else 
	{
		if(slNode.children[0].name == "epsilon")
		  return true;
		else
		  return false;
	}
}


// Return a string representation of the tree.
this.toString = function() {
// Initialize the result string.
	var traversalResult = "";
// Recursive function to handle the expansion of the nodes.
	function expand(node, depth)
	{
// Space out based on the current depth so
// this looks at least a little tree-like.
		for (var i = 0; i < depth; i++)
		{
			traversalResult += "-";
		}
// If there are no children (i.e., leaf nodes)...
	if (!node.children || node.children.length === 0)
	{
// ... note the leaf node.
		if(typeof node.name.name !== "undefined") //Right now, I pass in the entire symbol, need to print just name instead of object Object
		{
			traversalResult += "[" + node.name.name + "]";
			traversalResult += "\n";
		}
		else
		{
			traversalResult += "[" + node.name + "]";
			traversalResult += "\n";
		}
	}
	else
	{
// There are children, so note these interior/branch nodes and ...
		traversalResult += "<" + node.name + "> \n";
// .. recursively expand them.
		for (var i = 0; i < node.children.length; i++)
		{
			expand(node.children[i], depth + 1);
		}
	}
	}
// Make the initial call to expand from the root.
	expand(this.root, 0);
// Return the result.
	return traversalResult;
};
} 

