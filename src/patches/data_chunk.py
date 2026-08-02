from langchain.output_parsers.openai_tools import JsonOutputToolsParser
from langchain_community.chat_models import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableLambda
from langchain.chains import create_extraction_chain
from typing import Optional, List
from langchain.chains import create_extraction_chain_pydantic
from langchain_core.pydantic_v1 import BaseModel
from langchain import hub
import os
from dataloader import load_high
from agentic_chunker import AgenticChunker

# Pydantic data class
class Sentences(BaseModel):
    sentences: List[str]


import json
import re

def parse_propositions_robust(output_text: str) -> List[str]:
    output_text = output_text.strip()
    if not output_text:
        return []
        
    # Attempt 1: Try parsing as JSON array
    try:
        # Match JSON arrays of strings
        match = re.search(r'\[\s*".*?"\s*\]', output_text, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        if output_text.startswith('[') and output_text.endswith(']'):
            return json.loads(output_text)
    except Exception:
        pass
        
    # Attempt 2: Line-by-line parsing of bullet points or numbered lists
    sentences = []
    for line in output_text.split('\n'):
        line = line.strip()
        if not line:
            continue
        # Remove bullet markers (- , * , 1. )
        line = re.sub(r'^(?:\-\s+|\*\s+|\d+\.\s+)', '', line)
        line = line.strip('"`\'')
        if line:
            sentences.append(line)
    return sentences

def get_propositions(text, runnable, extraction_chain):
    runnable_output = runnable.invoke({
    	"input": text
    }).content
    
    try:
        # Try original OpenAI-functions extraction chain
        propositions = extraction_chain.run(runnable_output)[0].sentences
        return propositions
    except Exception as e:
        # Fallback to robust parsing for local/open-source LLMs (like Llama 3)
        return parse_propositions_robust(runnable_output)


def run_chunk(essay):

    obj = hub.pull("wfh/proposal-indexing")
    llm = ChatOpenAI(model='gpt-4-1106-preview', openai_api_key = os.getenv("OPENAI_API_KEY"))

    runnable = obj | llm

    # Extraction
    extraction_chain = create_extraction_chain_pydantic(pydantic_schema=Sentences, llm=llm)

    paragraphs = essay.split("\n\n")

    essay_propositions = []

    for i, para in enumerate(paragraphs):
        propositions = get_propositions(para, runnable, extraction_chain)
        
        essay_propositions.extend(propositions)
        print (f"Done with {i}")

    ac = AgenticChunker()
    ac.add_propositions(essay_propositions)
    ac.pretty_print_chunks()
    chunks = ac.get_chunks(get_type='list_of_strings')

    return chunks
    print(chunks)
